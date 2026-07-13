import { createInterface } from "node:readline/promises";

export interface ConfirmOptions {
  default?: boolean;
  assumeYes?: boolean;
  input?: NodeJS.ReadableStream & { isTTY?: boolean };
  stream?: NodeJS.WritableStream;
  ask?: (prompt: string) => Promise<string>;
}

/** A safe y/N gate. Failures and non-interactive input resolve to the default. */
export async function confirm(question: string, options: ConfirmOptions = {}): Promise<boolean> {
  const defaultAnswer = options.default ?? false;
  if (options.assumeYes === true) return true;

  const input = options.input ?? process.stdin;
  if (input.isTTY !== true && options.ask === undefined) return defaultAnswer;

  const suffix = defaultAnswer ? "[Y/n]" : "[y/N]";
  const prompt = `${question.trimEnd()} ${suffix} `;
  let close: (() => void) | undefined;
  try {
    let answer: string;
    if (options.ask) {
      answer = await options.ask(prompt);
    } else {
      const rl = createInterface({ input, output: options.stream ?? process.stdout });
      close = () => rl.close();
      answer = await rl.question(prompt);
    }
    const normalized = answer.trim().toLowerCase();
    if (normalized === "") return defaultAnswer;
    if (normalized === "y" || normalized === "yes") return true;
    if (normalized === "n" || normalized === "no") return false;
    return defaultAnswer;
  } catch {
    return defaultAnswer;
  } finally {
    close?.();
  }
}
