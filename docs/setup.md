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
git clone <repo-url> LightCues
cd LightCues
git switch dev
npm install
```

The scaffold should rebuild native modules for Electron on install (e.g. a `postinstall` step). If that fails, the cause is usually step 2.

Note: the app is not scaffolded yet (issue `.scratch/mvp/issues/01-scaffold.md`). Until then there is no `package.json` and nothing to install or run. Once it lands, the run, test and lint commands will be in `package.json` scripts.
