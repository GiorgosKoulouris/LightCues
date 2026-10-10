# Development

Building, testing and changing LightCues. For using the app, see the [README](../README.md).

## Where to run what

The app targets Windows. Engine and logic work can also run in the [devcontainer](../.devcontainer/README.md).

| Task | Devcontainer | Windows host |
| --- | --- | --- |
| `test`, `typecheck`, `lint`, `format`, `check` | ✓ | ✓ |
| `build` | ✓ | ✓ |
| `security:scan`, `security:test-rules` | ✓ | |
| `package` (Windows installer) | | ✓ |
| `dev`, `start` (runs the Electron app) | | ✓ |
| `e2e` (launches the built app) | | ✓ |
| DMX Outputs, rtpMIDI | | ✓ |

The container and the host each need their own `npm install`. In the container, `node_modules` is a separate Docker volume.

## Quickstart from source

Prerequisites (Windows): Git, Node.js 22.12 or newer (see [.nvmrc](../.nvmrc)), Visual Studio Build Tools 2022 with the C++ workload, and Python 3. Full details and troubleshooting: [setup.md](setup.md).

This builds `main`, the released code:

```powershell
git clone https://github.com/GiorgosKoulouris/LightCues.git LightCues
cd LightCues
npm install
npm run dev
```

The window opens on the Venue Patch view. The top bar's right end shows a green dot and "Engine": the engine process is running. Hover it for the reply time and uptime.

Run the tests:

```powershell
npm test
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app with hot reload. Windows host only. |
| `npm run build` | Build main, engine, preload and renderer into `out/`. |
| `npm start` | Run the built app. Windows host only. |
| `npm run package` | Build the Windows x64 installer, its blockmap and `latest.yml` into `dist/`. Never publishes. Windows host only: on Linux the NSIS step needs Wine. |
| `npm run icon` | Regenerate `build/icon.ico` from `build/icon.svg`. |
| `npm test` | Run the test suite (Vitest). |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run e2e` | Build, then launch the app and run the end-to-end tests in [e2e/](../e2e/) (Playwright). Opens the example, fires a Scene and checks the Virtual Output's frame in the channel monitor. Not part of `check`. Windows host only. |
| `npm run typecheck` | Typecheck engine, Electron side and renderer separately. |
| `npm run lint` | ESLint. Also blocks Electron/UI imports in `src/engine` and `src/shared`. |
| `npm run format` | Format with Prettier. |
| `npm run format:check` | Check formatting without writing. |
| `npm run check` | Typecheck, lint, format check and tests, in that order. Run before merging. |
| `npm run security:scan` | Security scan raw outputs. Devcontainer only. See [Security scan](#security-scan). |
| `npm run security:test-rules` | Test the custom Electron semgrep rules. Devcontainer only. |

## CI

GitHub Actions on `windows-latest` ([.github/workflows/](../.github/workflows/)):

| Event | What runs |
| --- | --- |
| Push to `stage` | Semver check on the `package.json` version, a warning when it has no [CHANGELOG.md](../CHANGELOG.md) section, `npm run check`, `npm run e2e`, `npm run package`. The installer is uploaded as a workflow artifact, kept 7 days. |
| Push to `main` | Same as `stage`. Also warns when code changed since the last `v*` tag and HEAD is untagged. |
| Push of tag `vX.Y.Z` | Fails unless the tag equals `v` + the `package.json` version and is on `main`. Also fails when the version has no [CHANGELOG.md](../CHANGELOG.md) section. Then `npm run check`, `npm run package`, and a GitHub Release with the installer, its blockmap and `latest.yml`, and the changelog section as its body ([release.yml](../.github/workflows/release.yml)). |
| Pull request to `main` | `npm run check` |
| Push to `dev` | Nothing |

`stage` is the squashed batch on its way to `main`. See [agents/staging.md](agents/staging.md). Releases: [agents/releasing.md](agents/releasing.md).

Actions are pinned by commit SHA, with the version in a trailing comment.

### Dependabot

[.github/dependabot.yml](../.github/dependabot.yml) opens monthly PRs against `dev`. npm gets two grouped PRs: dev dependencies and runtime. GitHub Actions get one PR each.

- No CI runs on `dev`. Run `npm run check` on the PR branch before merging, then pull `dev`.
- Merge or close open Dependabot PRs before a staging round ([agents/staging.md](agents/staging.md) step 1).
- Security updates are a repo setting, ungrouped. GitHub always opens them against `main`, whatever `target-branch` says. Don't merge them there: it breaks the fast-forward from `stage`. Apply the bump on `dev` and close the PR. The alert closes when the batch reaches `main`.
- `global-agent` is pinned by an override in `package.json` (under `@electron/get`). Dependabot doesn't need an ignore rule for it. Check the pin by hand when `@electron/get` moves.

## Third-party notices

The installer ships `resources/THIRD_PARTY_NOTICES.txt`: the name, version, license and license files of every npm package in the app, and the Open Fixture Library credit from [examples/README.md](../examples/README.md). Electron ships its own `LICENSE.electron.txt` and `LICENSES.chromium.html`.

[scripts/third-party-notices.mjs](../scripts/third-party-notices.mjs) writes it as electron-builder's `afterPack` hook, so `npm run package` makes it. The security scan's build skips it (`LIGHTCUES_SKIP_NOTICES=1`) and reports licenses instead. "What ships" is the scan's inventory of the packed app: its `node_modules`, Electron, and the packages Vite bundled into `out/` ([scripts/bundled-packages.mjs](../scripts/bundled-packages.mjs) lists them in `out/*/bundled-packages.json`).

Packaging fails when a package:

- has a license off the allow list in [scripts/security-scan/licenses.mjs](../scripts/security-scan/licenses.mjs) (GPL-3.0-only compatible). Replace the package, or add the license to the list if it is compatible.
- ships no LICENSE, COPYING or NOTICE file. Copy the upstream license file to `build/licenses/<name>@<version>.txt`. The version is in the name, so an update is checked again.

## Security scan

An ad hoc scan, not part of CI. It builds the app from one commit in a temporary worktree and checks what ships in the installer:

- dependency advisories (osv-scanner),
- source code (semgrep, with custom Electron rules),
- the Electron runtime against its release feed,
- licenses.

Claude then reviews the Electron security surface and writes one report to `reports/security/` (gitignored).

Runs in the [devcontainer](../.devcontainer/README.md) only. Ask Claude to "run the security scan", or run `npm run security:scan` for the raw outputs without a report. Options, reading the report and accepting risks: [security-scan.md](security-scan.md).

## Architecture

Electron app with three processes ([ADR 0002](adr/0002-electron-with-separate-engine-process.md)):

- **Engine** (`src/engine/`): an Electron utilityProcess. MIDI in, Scene resolution, DMX out, files, undo history. No Electron or UI imports, so it is testable under plain Node.
- **Main** (`src/main/`): creates the window, starts the engine and hands out MessagePorts.
- **Renderer** (`src/renderer/`): React UI. It talks to the engine directly over a MessagePort.

`src/shared/` holds the typed message contract and the data models used by both sides. See [setup.md §8](setup.md#8-source-layout) for the full layout. Design decisions: [adr/](adr/). Glossary: [CONTEXT.md](../CONTEXT.md).

## Contributing

Pull requests by arrangement: open an issue first.

- Work on the `dev` branch: `git switch dev`. `dev` reaches `main` squashed, through `stage`. See [agents/staging.md](agents/staging.md).
- A user-facing change adds a line under `## [Unreleased]` in [CHANGELOG.md](../CHANGELOG.md).
- Run `npm run check` before merging. CI runs it again on `stage` and on pull requests to `main`.
- Issues and specs are markdown files under `.scratch/<feature>/`. See [agents/issue-tracker.md](agents/issue-tracker.md).
- Use the domain terms from [CONTEXT.md](../CONTEXT.md) in code, UI and docs.
