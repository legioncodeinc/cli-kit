# Doctor adoption: declined actions now exit 0

Adopting `@legioncodeinc/cli-kit` changes one behavior, not just an import path:
a user who deliberately declines an action now receives exit code `0` instead of
Doctor's historical `EXIT_DECLINED` value of `2`. Exit code `2` remains reserved
for usage and parse errors. The kit intentionally provides no compatibility
alias for the old value.

Before:

```ts
export const EXIT_DECLINED = 2;
if (!(await confirm(question))) return EXIT_DECLINED;
```

After:

```ts
import { confirm, declined } from "@legioncodeinc/cli-kit";
if (!(await confirm(question))) return declined("Aborted."); // 0
```

## Doctor migration checklist

1. Remove `EXIT_DECLINED` from `src/cli/dispatch.ts` and its imports.
2. Route each declined confirmation through `declined()`.
3. Update tests that import `EXIT_DECLINED` or assert exit code `2` for a decline
   to assert `0`.
4. Update scripts and operational documentation that distinguish a decline by
   checking for status `2`.

## Consumer-repository audit (2026-07-12)

A read-only ripgrep across sibling repositories under
`C:\Users\mario\GitHub\the-apiary` found active dependencies in Doctor:

- `doctor/src/cli/dispatch.ts` defines `EXIT_DECLINED = 2` and returns it from
  four decline paths (lines 159, 176, 348, and 357 at audit time).
- `doctor/tests/cli/dispatch.test.ts` and `doctor/tests/cli/purge.test.ts` import
  and assert `EXIT_DECLINED`.
- Doctor's operational deep-dive says scripts may key off the distinct value.

The broader `return 2` results in Nectar and Honeycomb were usage-error paths,
not named decline dependencies. Because Doctor has confirmed active reliance,
this semantic change is highlighted in the changelog. It does not trigger a
legacy export; consumers must migrate their checks.
