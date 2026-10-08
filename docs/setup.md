# Local development setup (Windows)

What a Windows PC needs to build, run and test LightCues locally. For the container setup, see [.devcontainer/README.md](../.devcontainer/README.md).

## 1. Core tools

| Tool | Version | Why |
| --- | --- | --- |
| [Git for Windows](https://git-scm.com/download/win) | latest | Source control. Line endings are handled by `.gitattributes` (LF). |
| [Node.js](https://nodejs.org/) | LTS, 22 or newer | Tooling, tests, the engine outside Electron. npm comes with it. |
| [VS Code](https://code.visualstudio.com/) | latest | Editor. |

Check:

```powershell
git --version
node -v
npm -v
```

## 2. Native module build tools

The engine uses native modules: `@julusian/midi` (MIDI) and `serialport` (DMX over USB serial). They must be built against Electron's ABI, which needs a C++ toolchain.

1. Install [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **Desktop development with C++** workload. It includes MSVC and the Windows SDK.
2. Install [Python 3](https://www.python.org/downloads/windows/) (3.12 or newer). node-gyp uses it.

Check:

```powershell
py --version
& "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property displayName
```

## 3. MIDI

| Tool | Why |
| --- | --- |
| [rtpMIDI](https://www.tobias-erichsen.de/software/rtpmidi.html) | Network MIDI from the DAW laptop. Sessions appear as normal MIDI ports. |
| [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html) | Virtual MIDI ports. Lets you fire Triggers from a local DAW or test tool without a second laptop. |

## 4. DMX hardware (only for Output testing)

Enttec DMX USB Pro and DMXking ultraDMX devices show up as a COM port.

- Plug the device in and check **Device Manager → Ports (COM & LPT)**.
- If there is no COM port, install the [FTDI VCP driver](https://ftdichip.com/drivers/vcp-drivers/) (Enttec) or the driver from DMXking's site.

Not needed for engine work. The engine is testable without hardware.

## 5. VS Code extensions

- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- Vitest (`vitest.explorer`)
- Claude Code (`anthropic.claude-code`)

## 6. Project

```powershell
git clone https://github.com/GiorgosKoulouris/LightCues.git LightCues
cd LightCues
git switch dev
npm install
npm run dev
```

The window should show "Engine replied in N ms". That confirms the engine process is running.

`serialport` and `@julusian/midi` ship N-API prebuilds (win32-x64 included). N-API binaries load in both Node and Electron, so there is no rebuild step: the same install serves `npm test` and `npm run dev`. A native module without N-API prebuilds needs a `postinstall` step that rebuilds it for Electron. If that fails, the cause is usually step 2.

## 7. Commands

See [Commands in the README](../README.md#commands).

## 8. Source layout

| Path | Runs in | Notes |
| --- | --- | --- |
| `src/shared/` | everywhere | Typed message contract (`protocol.ts`) and the Fixture Profile model (`fixture-profile.ts`). |
| `src/engine/` | engine utilityProcess | No Electron or UI imports. Testable under plain Node. Includes OFL import, the Profile Library, Outputs (`serial-ports.ts` is the only file that loads `serialport`) and MIDI input (`midi-ports.ts` is the only file that loads `@julusian/midi`). |
| `src/main/` | Electron main | Window, engine process start-up (`engine-process.ts` is the utilityProcess entry). |
| `src/preload/` | renderer, isolated | Exposes `window.engine` (send commands, receive events). |
| `src/renderer/` | renderer | React UI. |

The UI talks to the engine over a direct MessagePort; main only hands out the ports.

## 9. Troubleshooting

### `npm run dev` fails with `Error: Electron uninstall`

The Electron binary was not downloaded. The `electron` package's install script downloads it and writes `node_modules\electron\path.txt`; electron-vite reports "Electron uninstall" when that file is missing.

Fix:

```powershell
node node_modules\electron\install.js
npm run dev
```

If the download is skipped or fails, check:

| Check | Expected | If not |
| --- | --- | --- |
| `$env:ELECTRON_SKIP_BINARY_DOWNLOAD` | empty | This is set on purpose in the devcontainer only. Remove it from the host environment. |
| `npm config get ignore-scripts` | `false` | `npm config set ignore-scripts false`, then `npm install`. |
| `Test-Path node_modules\electron\dist\electron.exe` | `True` | The download failed. Check proxy, firewall or antivirus. |
