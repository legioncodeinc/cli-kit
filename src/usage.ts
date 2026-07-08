/**
 * @legioncodeinc/cli-kit/usage — grouped usage-table formatter (inline PRD-001).
 *
 * A small, zero-dependency helper that renders a grouped usage table (verb
 * column + summary column) from a declarative input array, padding the verb
 * column to the widest entry **in that group**. This is the shared rendering
 * that Honeycomb's `usageText()` (`src/commands/dispatch.ts:104-123`) and
 * Doctor's `COMMAND_MENU` (`src/cli/command-table.ts:49-73`) both hand-roll.
 *
 * Design rules (inline PRD-001 spec, "Usage formatter"):
 *   - Returns a plain ASCII string. No ANSI color, no Unicode glyphs — color is
 *     the caller's job (via the {@link ./color.ts} module). The formatter returns
 *     plain strings so the caller can wrap names/summaries with `bold()`/`cyan()`
 *     before/after, or not.
 *   - Pure function: no side effects, no `console`/stream writes. The caller
 *     decides where the output goes (stdout for `--help`, stderr for
 *     unknown-command), matching the exit-codes module's "helpers return, never
 *     call process.exit" discipline.
 *   - Per-group padding, NOT global: a narrow group's verbs stay narrow. This
 *     keeps a short "System" group from inheriting the width of a long
 *     "Memory & recall" group.
 *   - Each verb line: two leading spaces, name padded to the group's widest
 *     name with spaces, two spaces, then the summary.
 *   - Groups are separated by a single blank line. A group with zero verbs is
 *     skipped entirely (no title rendered). Empty input returns `""`.
 *
 * Non-goal for v1: no per-command help rendering, no terminal-width wrapping
 * (verbs and summaries are expected to be short). The output carries no
 * trailing newline — the caller owns newline/stream behavior.
 *
 * @see {@link ../library/requirements/backlog/prd-001-cli-kit/prd-001-cli-kit-index.md}
 *   "Usage formatter (inline — no sub-PRD)" section.
 */

/** A single verb entry within a usage group: a name and its one-line summary. */
export interface UsageVerb {
  /** The verb/command name, e.g. `"remember"`. Padded to the group's widest name. */
  name: string;
  /** A short, single-line description shown in the summary column. */
  summary: string;
}

/** A titled group of verbs rendered as one block (header line + verb lines). */
export interface UsageGroup {
  /** Header line rendered above this group's verbs (e.g. `"Memory & recall"`). */
  title: string;
  /** The verbs in this group. A group with zero verbs is skipped entirely. */
  verbs: Array<{ name: string; summary: string }>;
}

/** Declarative input to {@link formatUsage}: an ordered list of usage groups. */
export interface UsageInput {
  /** Groups, rendered in order and separated by blank lines. */
  groups: UsageGroup[];
}

/**
 * Render a grouped usage table from a declarative input.
 *
 * Groups are separated by a single blank line. Within each group, verb names
 * are padded to the widest name **in that group** (not globally — keeps narrow
 * groups narrow). Each verb line is formatted as:
 *
 * ```
 *   <padded-name>  <summary>
 * ```
 *
 * two leading spaces, the name padded with spaces to the group's max width,
 * two spaces, then the summary. Returns a plain ASCII string — no color (color
 * is the caller's job). Empty groups (zero verbs) are skipped; empty input
 * (zero groups, or only empty groups) returns `""`.
 *
 * @param input - The declarative usage groups.
 * @returns The rendered usage table as a plain string (no trailing newline).
 */
export function formatUsage(input: UsageInput): string {
  // Skip groups that have no verbs — their titles are not rendered. This also
  // guards Math.max() below, which would return -Infinity on an empty array.
  const renderable = input.groups.filter((group) => group.verbs.length > 0);
  if (renderable.length === 0) {
    return "";
  }

  return renderable
    .map((group) => {
      // Per-group width: the longest name in THIS group (not global). Keeps a
      // narrow group from inheriting a wider group's column.
      const width = Math.max(...group.verbs.map((v) => v.name.length));
      const lines = group.verbs.map(
        (v) => `  ${v.name.padEnd(width)}  ${v.summary}`,
      );
      // Title line, then the padded verb lines. The caller joins groups with a
      // blank line below.
      return [group.title, ...lines].join("\n");
    })
    .join("\n\n");
}
