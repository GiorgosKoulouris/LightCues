# Coverage report

Status: ready-for-agent

See spec, "Decisions".

## Fix

- Add `@vitest/coverage-v8` (same major as `vitest`) to devDependencies.
- `vitest.config.ts`: `coverage` with provider `v8`, reporters `text-summary` and `html`, `include: ['src/**']`, excluding tests, `*.module.css` and `src/renderer/src/test-setup.ts`.
- `package.json`: `"coverage": "vitest run --coverage"`.
- `.gitignore`: `coverage/`. `.prettierignore`: `coverage/`.
- README Commands table (or `docs/development.md` once it exists): one row.

## Acceptance

- `npm run coverage` runs both Vitest projects and prints a summary.
- Write the per-file numbers for `src/engine/` into this issue's comments, sorted by uncovered lines. That list is the input for later test issues.
- `npm run check` passes and does not run coverage.
