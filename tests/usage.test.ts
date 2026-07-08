import { describe, expect, it } from "vitest";
import { formatUsage, type UsageInput } from "../src/usage.js";

/**
 * Tests for the grouped usage-table formatter (inline PRD-001 spec).
 *
 * The formatter is a pure string function: deterministic output, no side
 * effects, no ANSI codes, no console/stream writes. Output has no trailing
 * newline (the caller owns stream/newline behavior). We assert exact strings,
 * which is safe because the output is fully deterministic.
 */

describe("formatUsage — golden path (the PRD example)", () => {
  it("renders two grouped blocks with correct per-group padding", () => {
    const input: UsageInput = {
      groups: [
        {
          title: "Memory & recall",
          verbs: [
            { name: "remember", summary: "Write a memory" },
            { name: "recall", summary: "Recall memories (hybrid ranked)" },
          ],
        },
        {
          title: "System",
          verbs: [
            { name: "status", summary: "Connectivity + health diagnostic" },
            { name: "daemon", summary: "Daemon lifecycle" },
          ],
        },
      ],
    };

    // remember/recall padded to 8; status/daemon padded to 6 (no extra space).
    // Blank line separates the two groups. No trailing newline.
    const expected = [
      "Memory & recall",
      "  remember  Write a memory",
      "  recall    Recall memories (hybrid ranked)",
      "",
      "System",
      "  status  Connectivity + health diagnostic",
      "  daemon  Daemon lifecycle",
    ].join("\n");

    expect(formatUsage(input)).toBe(expected);
  });

  it("the padded names line up to a single column within each group", () => {
    const input: UsageInput = {
      groups: [
        {
          title: "Memory & recall",
          verbs: [
            { name: "remember", summary: "Write a memory" },
            { name: "recall", summary: "Recall memories (hybrid ranked)" },
          ],
        },
      ],
    };
    const out = formatUsage(input).split("\n");
    // Both verb lines must share the same column offset for the summary start:
    // "  remember  " and "  recall    " both place the summary at index 12.
    const rememberIdx = out[1].indexOf("Write");
    const recallIdx = out[2].indexOf("Recall");
    expect(rememberIdx).toBe(recallIdx);
    expect(rememberIdx).toBe(12); // 2 leading + 8 padded + 2 separator
  });
});

describe("formatUsage — acceptance criteria", () => {
  it("AC1+AC2+AC3: renders grouped usage with correct per-group padding and titles", () => {
    const input: UsageInput = {
      groups: [
        {
          title: "Memory & recall",
          verbs: [
            { name: "remember", summary: "Write a memory" },
            { name: "recall", summary: "Recall memories (hybrid ranked)" },
          ],
        },
        {
          title: "System",
          verbs: [
            { name: "status", summary: "Connectivity + health diagnostic" },
            { name: "daemon", summary: "Daemon lifecycle" },
          ],
        },
      ],
    };
    const out = formatUsage(input);
    // AC2: group titles appear as headers.
    expect(out).toContain("Memory & recall\n");
    expect(out).toContain("System\n");
    // AC1: per-group padding — "recall" is padded with 2 trailing spaces (to 8).
    expect(out).toContain("  recall    Recall memories");
    // AC1: "status"/"daemon" are NOT over-padded to 8; only single separator pair.
    expect(out).toContain("  status  Connectivity");
    expect(out).toContain("  daemon  Daemon lifecycle");
    expect(out).not.toContain("  status    ");
    expect(out).not.toContain("  daemon    ");
  });

  it("AC3: a blank line separates groups", () => {
    const input: UsageInput = {
      groups: [
        {
          title: "A",
          verbs: [{ name: "x", summary: "x-sum" }],
        },
        {
          title: "B",
          verbs: [{ name: "y", summary: "y-sum" }],
        },
      ],
    };
    expect(formatUsage(input)).toBe(
      ["A", "  x  x-sum", "", "B", "  y  y-sum"].join("\n"),
    );
  });

  it("AC4: per-group padding (not global) — a narrow group's verbs are not over-padded", () => {
    const input: UsageInput = {
      groups: [
        {
          title: "Wide",
          verbs: [{ name: "very-long-verb", summary: "wide summary" }],
        },
        {
          title: "Narrow",
          verbs: [{ name: "go", summary: "do the thing" }],
        },
      ],
    };
    const out = formatUsage(input);
    // The narrow group's "go" (2 chars) is padded only within its own group
    // (width 2 -> no padding), NOT to the wide group's 14 chars.
    expect(out).toContain("  go  do the thing");
    expect(out).not.toContain("  go            ");
    expect(out).toContain("  very-long-verb  wide summary");
  });

  it("AC5: empty groups (zero verbs) are skipped — no title rendered", () => {
    const input: UsageInput = {
      groups: [
        {
          title: "Empty A",
          verbs: [],
        },
        {
          title: "Real",
          verbs: [{ name: "act", summary: "do it" }],
        },
        {
          title: "Empty B",
          verbs: [],
        },
      ],
    };
    const out = formatUsage(input);
    expect(out).toBe(["Real", "  act  do it"].join("\n"));
    // Titles of empty groups must NOT appear anywhere.
    expect(out).not.toContain("Empty A");
    expect(out).not.toContain("Empty B");
  });

  it("AC6: empty input (zero groups) returns empty string", () => {
    expect(formatUsage({ groups: [] })).toBe("");
  });

  it("AC6b: input where every group is empty also returns empty string", () => {
    expect(
      formatUsage({
        groups: [
          { title: "Only empty", verbs: [] },
          { title: "Also empty", verbs: [] },
        ],
      }),
    ).toBe("");
  });

  it("AC7: returns a plain string — no ANSI escape codes and no side effects", () => {
    const input: UsageInput = {
      groups: [
        {
          title: "T",
          verbs: [{ name: "verb", summary: "summary text" }],
        },
      ],
    };
    const out = formatUsage(input);
    expect(typeof out).toBe("string");
    // No CSI / ESC sequences, no other control bytes.
    expect(out).not.toMatch(/\x1b\[/u);
    expect(out).not.toMatch(/\x1b/u);
    // ASCII-only: every char code <= 127.
    for (const ch of out) {
      expect(ch.codePointAt(0)).toBeLessThanOrEqual(127);
    }
  });

  it("AC8: handles single-group, single-verb input correctly", () => {
    const input: UsageInput = {
      groups: [
        {
          title: "Solo",
          verbs: [{ name: "only", summary: "the one verb" }],
        },
      ],
    };
    // Width is 4 ("only"); with a single verb there's no visible padding.
    expect(formatUsage(input)).toBe(["Solo", "  only  the one verb"].join("\n"));
  });
});

describe("formatUsage — edge cases", () => {
  it("handles groups with very different name widths within the same group", () => {
    const input: UsageInput = {
      groups: [
        {
          title: "Mixed",
          verbs: [
            { name: "a", summary: "short name, short summary" },
            { name: "supercalifragilistic", summary: "long name" },
          ],
        },
      ],
    };
    const out = formatUsage(input).split("\n");
    expect(out[0]).toBe("Mixed");
    // "a" padded to width 20 ("supercalifragilistic" = 20 chars).
    expect(out[1]).toBe("  a                     short name, short summary");
    expect(out[2]).toBe("  supercalifragilistic  long name");
    // Summaries align to the same column (2 + 20 + 2 = 24).
    expect(out[1].indexOf("short")).toBe(24);
    expect(out[2].indexOf("long")).toBe(24);
  });

  it("does not append a trailing newline", () => {
    const input: UsageInput = {
      groups: [
        {
          title: "T",
          verbs: [{ name: "v", summary: "s" }],
        },
      ],
    };
    expect(formatUsage(input)).not.toMatch(/\n$/u);
  });

  it("three groups get exactly two blank-line separators", () => {
    const input: UsageInput = {
      groups: [
        { title: "One", verbs: [{ name: "a", summary: "s" }] },
        { title: "Two", verbs: [{ name: "b", summary: "s" }] },
        { title: "Three", verbs: [{ name: "c", summary: "s" }] },
      ],
    };
    const out = formatUsage(input);
    // Exactly two occurrences of a blank line (the "\n\n" that separates groups).
    const blankCount = (out.match(/\n\n/gu) ?? []).length;
    expect(blankCount).toBe(2);
  });

  it("an empty group between two real groups does not create a double blank line", () => {
    const input: UsageInput = {
      groups: [
        { title: "A", verbs: [{ name: "a", summary: "s" }] },
        { title: "Skipped", verbs: [] },
        { title: "B", verbs: [{ name: "b", summary: "s" }] },
      ],
    };
    const out = formatUsage(input);
    expect(out).toBe(["A", "  a  s", "", "B", "  b  s"].join("\n"));
    // No doubled-up blank line from the skipped group.
    expect(out).not.toMatch(/\n\n\n/u);
  });

  it("names that are all equal length get exactly the two-space separator", () => {
    const input: UsageInput = {
      groups: [
        {
          title: "Equal",
          verbs: [
            { name: "foo", summary: "one" },
            { name: "bar", summary: "two" },
          ],
        },
      ],
    };
    expect(formatUsage(input)).toBe(
      ["Equal", "  foo  one", "  bar  two"].join("\n"),
    );
  });

  it("is pure: the same input yields byte-identical output across calls", () => {
    const input: UsageInput = {
      groups: [
        {
          title: "Memory & recall",
          verbs: [
            { name: "remember", summary: "Write a memory" },
            { name: "recall", summary: "Recall memories (hybrid ranked)" },
          ],
        },
        {
          title: "System",
          verbs: [
            { name: "status", summary: "Connectivity + health diagnostic" },
            { name: "daemon", summary: "Daemon lifecycle" },
          ],
        },
      ],
    };
    const first = formatUsage(input);
    const second = formatUsage(input);
    const third = formatUsage(input);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });
});
