# LightCues

A Windows lighting controller for live music shows.

Program a Show once and run it at any venue. Scenes target stage Zones and fixture Roles, not specific fixtures. Each venue gets its own Venue Patch describing the rig, and the Show adapts to it. A DAW or MIDI controller fires Scenes during the gig. A Fallback Panel keeps manual control available if MIDI drops.

## How it works

- A **Show** holds Scenes and MIDI Triggers. It is venue-independent.
- A **Venue Patch** describes one venue's rig: Fixtures, their Profiles, DMX addresses and stage positions.
- A **Scene** is a look or effect. Its Rules target **Zones** (a fixed stage grid) × **Roles** (Wash, Spot/Beam, Blinder, …).
- Scenes play in **Layers**. Each Layer holds one Scene, and Layers stack.
- **Triggers** map incoming MIDI messages to Scene actions: Go, Flash or Release.
- The **Fallback Panel** is always visible: Blackout, Base Look, Grand Master and chosen Scene buttons, all with keyboard shortcuts.

Full glossary: [CONTEXT.md](CONTEXT.md). Design decisions: [docs/adr/](docs/adr/).

## Hardware

| Kind | Supported |
| --- | --- |
| DMX Outputs | Enttec DMX USB Pro and DMXking ultraDMX (Enttec protocol over USB serial) |
| MIDI | Any Windows MIDI port. [rtpMIDI](https://www.tobias-erichsen.de/software/rtpmidi.html) for network MIDI from a DAW laptop, [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html) for local virtual ports |
| Fixture Profiles | Imported from the [Open Fixture Library](https://open-fixture-library.org/) or made in the app |

## Where to run what

The app targets Windows. Engine and logic work can also run in the [devcontainer](.devcontainer/README.md).

| Task | Devcontainer | Windows host |
| --- | --- | --- |
| `test`, `typecheck`, `lint`, `format`, `check` | ✓ | ✓ |
| `build` | ✓ | ✓ |
| `dev`, `start` (runs the Electron app) | | ✓ |
| DMX Outputs, rtpMIDI | | ✓ |

The container and the host each need their own `npm install`. In the container, `node_modules` is a separate Docker volume.

## Quickstart

Prerequisites (Windows): Git, Node.js 22.12 or newer (see [.nvmrc](.nvmrc)), Visual Studio Build Tools 2022 with the C++ workload, and Python 3. Full details and troubleshooting: [docs/setup.md](docs/setup.md).

```powershell
git clone https://github.com/GiorgosKoulouris/LightCues.git LightCues
cd LightCues
git switch dev
npm install
npm run dev
```

The window should show "Engine replied in N ms". That means the engine process is running.

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
| `npm test` | Run the test suite (Vitest). |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run typecheck` | Typecheck engine, Electron side and renderer separately. |
| `npm run lint` | ESLint. Also blocks Electron/UI imports in `src/engine` and `src/shared`. |
| `npm run format` | Format with Prettier. |
| `npm run format:check` | Check formatting without writing. |
| `npm run check` | Typecheck, lint, format check and tests, in that order. Run before merging. |

## Architecture

Electron app with three processes ([ADR 0002](docs/adr/0002-electron-with-separate-engine-process.md)):

- **Engine** (`src/engine/`): an Electron utilityProcess. MIDI in, Scene resolution, DMX out, files, undo history. No Electron or UI imports, so it is testable under plain Node.
- **Main** (`src/main/`): creates the window, starts the engine and hands out MessagePorts.
- **Renderer** (`src/renderer/`): React UI. It talks to the engine directly over a MessagePort.

`src/shared/` holds the typed message contract and the data models used by both sides. See [docs/setup.md §8](docs/setup.md#8-source-layout) for the full layout.

## Contributing

- Work on the `dev` branch. `main` receives merges from `dev`.
- Run `npm run check` before merging.
- Issues and specs are markdown files under `.scratch/<feature>/`. See [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).
- Use the domain terms from [CONTEXT.md](CONTEXT.md) in code, UI and docs.

## License

Copyright (C) 2026 Georgios Koulouris

LightCues is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License, version 3, as published by the Free Software Foundation. It is distributed without any warranty. See [LICENSE](LICENSE).
