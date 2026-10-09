# End-to-end smoke test on Windows CI

Status: resolved

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

## Comments

### 2026-10-09: resolved

- No test-only hooks and no `LIGHTCUES_E2E`. The test uses only the UI. "Open example" already needs no native dialog, because main grants the two example paths itself (ADR 0010). The frame is read from the channel monitor grid, so there is nothing to strip from the packaged app.
- `e2e/smoke.test.ts` (Playwright `_electron.launch` on the built `out/`): Open example, open the channel monitor in Venue Patch, press the Fallback Panel's "Chorus: full red" Scene button, poll until a Front PAR channel (Universe 1, 1–16) is non-zero, hover it and check the readout names a Front PAR. Then Blackout on the Fallback Panel and poll until all 512 channels are 0.
- Deviation: the Scene is pressed on the Fallback Panel strip under Venue Patch, not in Perform. Perform replaces the strip and its Scene buttons take another path (`pressScene`). The strip's buttons go through `runPanelAction`, as the spec asks.
- Isolation: launched with `--user-data-dir=<temp>`, and the test checks that `app.getPath('userData')` is that folder. No recent files reopen, and the host's settings are untouched. `ELECTRON_RENDERER_URL` is dropped from the env, so the built renderer loads.
- `playwright.config.ts`: `e2e/`, 1 worker, `github` reporter on CI. `package.json`: `"e2e": "npm run build && playwright test"`, not in `check`. `e2e/` and the config are typechecked (`tsconfig.node.json`) and linted. `test-results/` is ignored.
- `ci.yml`: `npm run e2e` after `check`, on pushes only (`stage`, `main`). `docs/development.md` and `docs/agents/releasing.md` updated.
- Not run here: the devcontainer never downloads Electron (`ELECTRON_SKIP_BINARY_DOWNLOAD=1`). Still open on the Windows host: `npm run e2e` passes, and renaming the `engine` bridge in the preload makes it fail (then revert). CI on `windows-latest` runs it on the next `stage` push. Done here: `npm run check`, `npm run build`, `playwright test --list`.
