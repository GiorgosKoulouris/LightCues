# Test coverage

Batch 3 of the 2026-10-09 repo plan.

47 test files, about 12k lines of tests for 14k lines of source. Several engine modules have no test file of their own: `movement-effects`, `path-grants`, `validate-profile`, `history`, `import-report`, `show-session`, `venue-session`. Some are covered through `engine.test.ts` (path grants, undo) or `playback.test.ts` (one Pan sweep). Nobody knows how much, because there's no coverage report. Main and preload are untested apart from `navigation.test.ts`.

## Scope

1. A coverage report (issue 01).
2. Direct tests for movement Effects (issue 02).
3. Direct tests for Profile validation (issue 03).

The end-to-end smoke test is in `try-without-hardware` (it needs the Virtual Output).

Out of scope: a coverage gate in CI, tests for every module just to have a file per module.

## Decisions (2026-10-09)

- Coverage with `@vitest/coverage-v8`. `npm run coverage` writes a text summary and an HTML report to `coverage/` (gitignored). Not part of `npm run check`. Not a CI gate.
- Pick further targets from the report, not by file count. Modules where a bug shows on stage (movement maths, scene resolution, DMX encoding) or that take untrusted input (imports, validation, file reads) come first.
- Movement Effects and Profile validation are written now, because they are high risk and only partly covered.

## Order

01 first, so 02 and 03 can show their gain. 02 and 03 in any order.
