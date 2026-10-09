# End-to-end smoke test on Windows CI

Status: ready-for-agent

Blocked by: 01, 03

See spec.

## Problem

Unit and component tests never start the real app. A broken preload, a missing native module in the package or a dead engine port would pass `npm run check`.

## Fix

- Add `@playwright/test` (devDependency). Use its Electron support (`_electron.launch`) against the built app in `out/`.
- `e2e/smoke.test.ts` (new), outside the Vitest projects:
  1. Launch the app.
  2. Open the example through the same path as "Open example". Use an env var or test-only IPC that exists only when `LIGHTCUES_E2E=1`, so the native dialog is skipped.
  3. Go to Perform, press a Fallback Panel Scene button.
  4. Read the Virtual Output's frame (through the channel monitor UI, or a test-only hook gated the same way) and check that a Fixture of that Scene is non-zero.
  5. Press Blackout and check the frame is all zero.
- `package.json`: `"e2e": "npm run build && playwright test"`. Not part of `check`, because it needs a display and Windows native modules.
- `ci.yml`: run `npm run e2e` on `stage` and `main` pushes, after `check`.
- Make sure the test-only hooks don't open a path around ADR 0010: main registers them only when the env var is set at launch, and they grant only the example paths. Prefer a build-time flag that strips them from the packaged app, if electron-vite makes that simple.

## Acceptance

- `npm run e2e` passes on the Windows host and in CI on `windows-latest`.
- Breaking the preload on purpose (e.g. renaming the `engine` bridge) makes it fail. Revert after the check.
- `npm run check` passes.
