import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	amber,
	bold,
	cyan,
	dim,
	disableColor,
	green,
	isColorEnabled,
	red,
	setColorEnabled,
	yellow,
} from "../src/color.js";

/**
 * A minimal WriteStream stub for TTY resolution. Only `isTTY` is read by the
 * color module; we cast to satisfy the NodeJS.WriteStream type.
 */
function mockStream(isTTY: boolean): NodeJS.WriteStream {
	return { isTTY } as unknown as NodeJS.WriteStream;
}

const ESC = "\x1b";
const sgr = (code: string): string => `${ESC}[${code}m`;

describe("color — AC-a7: module exports are callable", () => {
	it("exports the three control functions and seven style helpers", () => {
		expect(typeof setColorEnabled).toBe("function");
		expect(typeof disableColor).toBe("function");
		expect(typeof isColorEnabled).toBe("function");
		expect(typeof bold).toBe("function");
		expect(typeof dim).toBe("function");
		expect(typeof red).toBe("function");
		expect(typeof green).toBe("function");
		expect(typeof yellow).toBe("function");
		expect(typeof cyan).toBe("function");
		expect(typeof amber).toBe("function");
	});
});

describe("color — env/TTY resolution (AC-a1..a4)", () => {
	/** Snapshot of env so each test mutates an isolated copy. */
	let envBackup: NodeJS.ProcessEnv;

	beforeEach(() => {
		envBackup = { ...process.env };
		// Ensure a clean baseline for the two gate vars.
		delete process.env.NO_COLOR;
		delete process.env.FORCE_COLOR;
	});

	afterEach(() => {
		// Restore env and neutralize module state so tests don't leak.
		process.env = envBackup;
		disableColor();
	});

	it("AC-a1: NO_COLOR set (any value, incl empty) → disabled", () => {
		for (const value of ["", "1", "0", "false", "anything"]) {
			process.env.NO_COLOR = value;
			setColorEnabled(mockStream(true));
			expect(isColorEnabled(), `NO_COLOR="${value}" should disable`).toBe(false);
		}
	});

	it("AC-a1 (edge): NO_COLOR present even when FORCE_COLOR is set → disabled (NO_COLOR wins)", () => {
		process.env.NO_COLOR = "";
		process.env.FORCE_COLOR = "1";
		setColorEnabled(mockStream(true));
		expect(isColorEnabled()).toBe(false);
	});

	it("AC-a2: FORCE_COLOR=1 + piped stdout (isTTY false) → enabled", () => {
		process.env.FORCE_COLOR = "1";
		setColorEnabled(mockStream(false));
		expect(isColorEnabled()).toBe(true);
	});

	it("AC-a2: FORCE_COLOR truthy non-`1` values also force on", () => {
		for (const value of ["true", "yes", "2", "force"]) {
			process.env.FORCE_COLOR = value;
			setColorEnabled(mockStream(false));
			expect(isColorEnabled(), `FORCE_COLOR="${value}" should enable`).toBe(true);
		}
	});

	it("AC-a3: no env vars, stdout isTTY true → enabled", () => {
		setColorEnabled(mockStream(true));
		expect(isColorEnabled()).toBe(true);
	});

	it("AC-a4: no env vars, stdout isTTY false → disabled", () => {
		setColorEnabled(mockStream(false));
		expect(isColorEnabled()).toBe(false);
	});

	it("default stream is process.stdout when none passed", () => {
		// No env gates → should mirror process.stdout.isTTY.
		setColorEnabled();
		expect(isColorEnabled()).toBe(process.stdout.isTTY === true);
	});

	it("FORCE_COLOR empty string does NOT force on (falls through to TTY)", () => {
		process.env.FORCE_COLOR = "";
		setColorEnabled(mockStream(false));
		expect(isColorEnabled()).toBe(false);
		setColorEnabled(mockStream(true));
		expect(isColorEnabled()).toBe(true);
	});

	it("can resolve stderr independently of stdout", () => {
		// stdout piped, stderr a TTY → enabling against stderr wins.
		const stderrTty = mockStream(true);
		setColorEnabled(stderrTty);
		expect(isColorEnabled()).toBe(true);
	});
});

describe("color — disableColor (override)", () => {
	afterEach(() => {
		disableColor();
	});

	it("disableColor forces false even when env/TTY would enable", () => {
		const env = { ...process.env, FORCE_COLOR: "1" };
		process.env = env;
		setColorEnabled(mockStream(true));
		expect(isColorEnabled()).toBe(true);

		disableColor();
		expect(isColorEnabled()).toBe(false);
	});

	it("disableColor is idempotent", () => {
		disableColor();
		const first = isColorEnabled();
		disableColor();
		const second = isColorEnabled();
		expect(first).toBe(false);
		expect(second).toBe(false);
	});

	it("disableColor overrides a prior setColorEnabled call", () => {
		const env = { ...process.env };
		delete env.NO_COLOR;
		process.env = env;
		setColorEnabled(mockStream(true));
		disableColor();
		expect(isColorEnabled()).toBe(false);
	});
});

describe("color — AC-a5: identity when disabled", () => {
	beforeEach(() => {
		disableColor();
	});

	afterEach(() => {
		disableColor();
	});

	it("every helper returns input unchanged (no SGR codes)", () => {
		const inputs = ["hello", "", "with\nnewline", "unicode → 🐝", "tab\there"];
		for (const input of inputs) {
			expect(bold(input), `bold(${JSON.stringify(input)})`).toBe(input);
			expect(dim(input)).toBe(input);
			expect(red(input)).toBe(input);
			expect(green(input)).toBe(input);
			expect(yellow(input)).toBe(input);
			expect(cyan(input)).toBe(input);
			expect(amber(input)).toBe(input);
		}
	});

	it("identity output contains no ESC byte at all", () => {
		const out = bold("x") + red("y") + amber("z");
		expect(out.includes(ESC)).toBe(false);
	});

	it("isColorEnabled() is false in this state", () => {
		expect(isColorEnabled()).toBe(false);
	});
});

describe("color — AC-a6 / SGR codes when enabled", () => {
	let envBackup: NodeJS.ProcessEnv;

	beforeEach(() => {
		envBackup = { ...process.env };
		delete process.env.NO_COLOR;
		delete process.env.FORCE_COLOR;
		setColorEnabled(mockStream(true));
		expect(isColorEnabled()).toBe(true);
	});

	afterEach(() => {
		process.env = envBackup;
		disableColor();
	});

	it("AC-a6: amber('hi') wraps in 38;5;214 foreground + reset ESC[39m", () => {
		const out = amber("hi");
		expect(out.startsWith(sgr("38;5;214"))).toBe(true);
		expect(out.endsWith(sgr("39"))).toBe(true);
		expect(out).toBe(`${sgr("38;5;214")}hi${sgr("39")}`);
	});

	it("bold wraps in 1 + reset 22", () => {
		expect(bold("x")).toBe(`${sgr("1")}x${sgr("22")}`);
	});

	it("dim wraps in 2 + reset 22", () => {
		expect(dim("x")).toBe(`${sgr("2")}x${sgr("22")}`);
	});

	it("red wraps in 31 + reset 39", () => {
		expect(red("x")).toBe(`${sgr("31")}x${sgr("39")}`);
	});

	it("green wraps in 32 + reset 39", () => {
		expect(green("x")).toBe(`${sgr("32")}x${sgr("39")}`);
	});

	it("yellow wraps in 33 + reset 39", () => {
		expect(yellow("x")).toBe(`${sgr("33")}x${sgr("39")}`);
	});

	it("cyan wraps in 36 + reset 39", () => {
		expect(cyan("x")).toBe(`${sgr("36")}x${sgr("39")}`);
	});

	it("all helpers emit exactly one ESC open and one ESC close", () => {
		for (const fn of [bold, dim, red, green, yellow, cyan, amber]) {
			const out = fn("mid");
			const escCount = out.split(ESC).length - 1;
			expect(escCount, `${fn.name} should emit exactly two ESC sequences`).toBe(2);
			expect(out.startsWith(`${ESC}[`)).toBe(true);
			expect(out.endsWith(`${ESC}[`) === false).toBe(true);
		}
	});
});

describe("color — live state reactivity", () => {
	afterEach(() => {
		disableColor();
	});

	it("helpers reflect state changes between calls (no capture at first call)", () => {
		setColorEnabled(mockStream(true));
		expect(amber("hi")).toContain(sgr("38;5;214"));

		disableColor();
		expect(amber("hi")).toBe("hi");
	});
});
