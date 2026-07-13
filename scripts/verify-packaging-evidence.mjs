import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temp = mkdtempSync(join(tmpdir(), "cli-kit-packaging-"));
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" });
const runNpm = (args) => process.platform === "win32"
  ? run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm", ...args])
  : run("npm", args);

function moduleExports(entry) {
  const program = ts.createProgram([entry], {
    module: ts.ModuleKind.Node16,
    moduleResolution: ts.ModuleResolutionKind.Node16,
    target: ts.ScriptTarget.ES2023,
    skipLibCheck: true,
  });
  const source = program.getSourceFile(entry);
  assert(source, `missing source file ${entry}`);
  const symbol = program.getTypeChecker().getSymbolAtLocation(source);
  assert(symbol, `missing module symbol ${entry}`);
  return program.getTypeChecker().getExportsOfModule(symbol).map((item) => item.name).sort();
}

try {
  runNpm(["run", "build"]);

  // AC-e2: every name captured before the export-star to named-export refactor remains public.
  const baseline = JSON.parse(readFileSync(join(root, "library/notes/public-surface-baseline.json"), "utf8"));
  const current = moduleExports(join(root, "dist/index.d.ts"));
  const missing = baseline.exports.filter((name) => !current.includes(name));
  assert.deepEqual(missing, [], `pre-refactor public exports missing: ${missing.join(", ")}`);

  // AC-e3: a deliberate duplicate named export is rejected by TypeScript.
  const duplicate = join(temp, "duplicate");
  mkdirSync(duplicate);
  writeFileSync(join(duplicate, "a.ts"), "export const collision = 1;\n");
  writeFileSync(join(duplicate, "b.ts"), "export const collision = 2;\n");
  writeFileSync(join(duplicate, "index.ts"), 'export { collision } from "./a.js";\nexport { collision } from "./b.js";\n');
  const duplicateProgram = ts.createProgram([join(duplicate, "index.ts")], {
    noEmit: true, strict: true, module: ts.ModuleKind.Node16, moduleResolution: ts.ModuleResolutionKind.Node16,
  });
  const duplicateDiagnostics = ts.getPreEmitDiagnostics(duplicateProgram);
  assert(duplicateDiagnostics.some((diagnostic) => diagnostic.code === 2300), "duplicate export did not produce TS2300");

  // AC-l4: declaration-map emission cannot change runtime JS or the semantic declaration surface.
  const sourceRoot = join(temp, "source");
  cpSync(join(root, "src"), sourceRoot, { recursive: true });
  const compile = (name, declarationMap) => {
    const outDir = join(temp, name);
    const config = {
      compilerOptions: {
        target: "ES2023", module: "Node16", moduleResolution: "Node16", rootDir: sourceRoot,
        outDir, declaration: true, declarationMap, strict: true, esModuleInterop: true,
        skipLibCheck: true, forceConsistentCasingInFileNames: true,
        typeRoots: [join(root, "node_modules/@types")], types: ["node"],
      },
      include: [sourceRoot],
    };
    const configPath = join(temp, `${name}.json`);
    writeFileSync(configPath, JSON.stringify(config));
    run(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "-p", configPath]);
    return outDir;
  };
  const withoutMaps = compile("without-maps", false);
  const withMaps = compile("with-maps", true);
  const sourceFiles = currentSourceFiles(sourceRoot);
  for (const relative of sourceFiles) {
    const js = relative.replace(/\.ts$/, ".js");
    assert.equal(readFileSync(join(withoutMaps, js), "utf8"), readFileSync(join(withMaps, js), "utf8"), `runtime JS changed: ${js}`);
    const dts = relative.replace(/\.ts$/, ".d.ts");
    const normalize = (value) => value.replace(/^\/\/# sourceMappingURL=.*$/gm, "").trim();
    assert.equal(normalize(readFileSync(join(withoutMaps, dts), "utf8")), normalize(readFileSync(join(withMaps, dts), "utf8")), `type surface changed: ${dts}`);
  }

  // AC-l3: TypeScript's source-definition lookup follows the packed declaration map into shipped src/index.ts.
  const packed = JSON.parse(runNpm(["pack", "--json"]));
  const tarball = resolve(root, packed[0].filename);
  const packageDir = join(temp, "consumer", "node_modules", "@legioncodeinc", "cli-kit");
  mkdirSync(packageDir, { recursive: true });
  run("tar", ["-xzf", tarball, "--strip-components=1", "-C", packageDir]);
  rmSync(tarball);
  const consumer = join(temp, "consumer", "index.ts");
  writeFileSync(consumer, 'import { bold } from "@legioncodeinc/cli-kit";\nbold("x");\n');
  const host = languageServiceHost(consumer);
  const service = ts.createLanguageService(host);
  const position = readFileSync(consumer, "utf8").indexOf("bold");
  const definitions = service.getDefinitionAtPosition(consumer, position) ?? [];
  assert(definitions.length > 0, "language service returned no package definition");
  const sourceTargets = definitions.flatMap((definition) => {
    const mapPath = `${definition.fileName}.map`;
    const map = JSON.parse(readFileSync(mapPath, "utf8"));
    return map.sources.map((source) => resolve(dirname(mapPath), map.sourceRoot ?? "", source));
  });
  assert(sourceTargets.some((target) => /[\\/]src[\\/].+\.ts$/.test(target) && ts.sys.fileExists(target)),
    `packed declaration-map chain did not resolve to shipped TypeScript source: ${sourceTargets.join(", ")}`);

  console.log(`AC-e2 PASS: ${baseline.exports.length} pre-refactor exports preserved`);
  console.log("AC-e3 PASS: duplicate named export rejected with TS2300");
  console.log(`AC-l4 PASS: ${sourceFiles.length} runtime/type outputs invariant with declarationMap toggle`);
  console.log("AC-l3 PASS: language-service definition and declaration map resolve to shipped TypeScript source");
} finally {
  rmSync(temp, { recursive: true, force: true });
}

function currentSourceFiles(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = join(prefix, entry.name);
    return entry.isDirectory() ? currentSourceFiles(join(directory, entry.name), relative) : entry.name.endsWith(".ts") ? [relative] : [];
  });
}

function languageServiceHost(file) {
  const options = { module: ts.ModuleKind.Node16, moduleResolution: ts.ModuleResolutionKind.Node16, target: ts.ScriptTarget.ES2023 };
  return {
    getScriptFileNames: () => [file], getScriptVersion: () => "0",
    getScriptSnapshot: (name) => { try { return ts.ScriptSnapshot.fromString(readFileSync(name, "utf8")); } catch { return undefined; } },
    getCurrentDirectory: () => dirname(file), getCompilationSettings: () => options,
    getDefaultLibFileName: (opts) => ts.getDefaultLibFilePath(opts),
    fileExists: ts.sys.fileExists, readFile: ts.sys.readFile, readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists, getDirectories: ts.sys.getDirectories,
  };
}
