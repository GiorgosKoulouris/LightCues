# Scaffold Electron app with separate engine process

Status: resolved

Set up Electron + TypeScript + React with the engine in an Electron utilityProcess. Define a typed message contract (commands UI → engine, state engine → UI). Add a test runner and lint.

## Acceptance

- App launches on Windows; engine process starts and replies to a ping.
- Engine code has no Electron/UI imports and runs standalone under the test runner.

## Comments

### 2026-10-07: implemented on `dev` (agent, devcontainer)

Done:

- electron-vite 5 + Electron 44 + TypeScript 6.0 + React 19. Vitest for tests, ESLint (flat config) for lint, Prettier for format.
- Engine runs in a `utilityProcess` (`src/main/engine-process.ts` → `src/engine/serve.ts`). Main gives the window a direct MessagePort to the engine on every page load. UI traffic never passes through main.
- Typed contract in `src/shared/protocol.ts`: `EngineCommand` (UI → engine), `EngineEvent` (engine → UI), `EngineConnect` (main → engine), `EngineBridge` (`window.engine`).
- Engine isolation is enforced twice: ESLint `no-restricted-imports` blocks Electron/React/main/preload/renderer imports in `src/engine` and `src/shared`, and `tsconfig.engine.json` has no DOM or Electron types.
- Engine tests (`src/engine/*.test.ts`) run under plain Node with fake ports.
- `npm test`, `typecheck`, `lint`, `build`, `format:check` all pass in the devcontainer.

Needs a human (Windows host):

- [x] `npm install`, then `npm run dev`. The window should show "Engine replied in N ms". The Electron binary is not installed in the devcontainer, so this was not run.

Deferred:

- Native module rebuild for Electron (`postinstall`) waits for the first native dependency (issues 06, 10). See `docs/setup.md` §6.
- No engine restart or UI notice if the engine process exits. Main only logs it.
- Incoming commands are cast, not validated. Add a guard when real commands land.
- The contract has no state event yet, only `ping`/`pong`.

### 2026-10-07: verified on Windows host

`npm run dev` works on the Windows host; the engine replies to the ping. First run failed with `Error: Electron uninstall` (Electron binary not downloaded); fixed with `node node_modules\electron\install.js`. Documented in `docs/setup.md` §9.
