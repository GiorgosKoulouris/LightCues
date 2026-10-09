# Demo Venue Patch and Show

Status: ready-for-agent

Blocked by: 01

See spec, "Demo content".

## Fix

- Pick OFL fixtures that fit the rig in the spec: a common RGBW PAR, a moving head with pan/tilt and a colour wheel or RGB, a 2-lamp blinder, and a multi-Cell bar (8 or more Cells). Confirm the OFL data license and record it in `examples/README.md`.
- `examples/demo.lcvenue` and `examples/demo.lcshow` (new): build them in the app or with a small script that uses the real `shared/` models, so they pass the same validation. Give Fixtures realistic stage positions and Mounting. Map all Universes to `virtual`.
- `electron-builder.yml`: `extraResources` `examples/` → `examples/`.
- `src/main/index.ts`: a Help menu entry or a renderer button "Open example". Main resolves `process.resourcesPath/examples` (or the repo folder in dev), grants both paths, and tells the renderer to open them. The engine opens them with no saved path, so Save asks where.
- Startup screen or empty state: a hint "New here? Open the example." when nothing is open.

## Acceptance

- A test loads both files through the real `show-file`/`venue-file` parsers and checks every Role, at least 3 Zones, a moving Fixture and a multi-Cell Fixture are present, and every Trigger names an existing Scene.
- In the dev build on Windows: Open example → Perform → fire each Trigger from a MIDI port (loopMIDI) or the Fallback Panel. The Preview and the channel monitor react.
- Save after opening the example asks for a location.
- `npm run check` passes.

## Comments

2026-10-09 (from `public-face/02`): the README's First Show has an HTML comment where "open the example" goes. Replace it with the steps to open the demo Show and Venue Patch.
