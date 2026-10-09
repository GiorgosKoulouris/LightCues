# Demo Venue Patch and Show

Status: resolved

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

### 2026-10-09: resolved

- Fixtures (OFL, MIT; copied as downloaded to `scripts/make-examples/ofl/`, commit `174eae5`): Showtec Club Par 12/4 RGBW (RGBW mode), Eurolite LED TMH-9 (12-channel: pan/tilt, RGBW), Showtec LED Blinder 2 COB (2-channel), Stairville LED Bar 240/8 (24-channel, 8 Cells). License credit and full MIT text in `examples/README.md`, which ships.
- OFL matrix support added to `ofl-import.ts`. It was needed: no OFL 2-lamp blinder or 8+ Cell bar imported without it. It resolves template channels for every pixel and pixel group key (OFL key rules) and expands `matrixChannels` inserts (`repeatFor` list, `eachPixelABC`, `eachPixelXYZ`-style, `eachPixelGroup`; `perPixel`, `perChannel`). Available channels override resolved ones. A mode key the fixture does not define is now reported as "Unknown channel" (was "Matrix channel"). Every fixture in OFL now imports with no mode dropped. CONTEXT.md: Cell names from OFL are like "Red 2".
- Rig: 8 × 6 m stage. 4 front PARs on a truss over the audience, 2 heads hung upstage (Universe 2), 2 blinders on the downstage edge, the bar upstage on the floor. Both Universes on `virtual`. Every Role is covered by two Role overrides: Blinder SL is Strobe, Head SL is Effect. 9 Fixtures of 4 types can't cover 6 Roles otherwise.
- Show: 8 Scenes on 3 Layers (Looks, Movement, Hits). Triggers on channel 1 from C3 (note 48), on white keys: Go, Flash (Blinder hit) and Release (B3 clears Movement). Base Look and Fallback Panel Scenes are set. No Directions are approximated in the Venue Check.
- `scripts/make-examples/demo.ts` builds both files with the real models and `save*File`. `npm run examples` writes them (`scripts/make-examples.mjs`, via Vite's `runnerImport`). Indented JSON.
- Engine: `openVenue`/`openShow` take `asNew`. The file loads with no path and is not remembered for reopen (like New), so Save asks where.
- Main: `dialog:openExample` grants `resources/examples/demo.*` (repo `examples/` in dev) and returns the paths. ADR 0010 amended for this dialog-less grant.
- UI: no app menu exists, so this is a renderer button. "Open example" sits at the bottom of the Sidebar, outside Perform. A "New here?" hint shows under the top bar while nothing is open (no paths, no Scenes, no Fixtures). It asks once before discarding unsaved changes to either document.
- `electron-builder.yml`: `extraResources` `examples` → `examples`. README First Show: the placeholder is replaced with the steps.
- Known: the open view's selection is not cleared when the example replaces the documents. It is harmless, because views ignore ids that are no longer in the document.
- Tests: `scripts/make-examples/demo.test.ts` (files match the builder, every Role, ≥ 3 Zones, moving and 8-Cell Fixture, all Universes virtual, Triggers ≥ C3 name existing Scenes, Go/Flash/Release, every Rule targets a Fixture, no approximated aims), `ofl-import.test.ts` (matrix cases), `recent-files.test.ts` (open as new), `App.test.tsx` (hint, discard prompt). `npm run check` passes.
- Not run here (no Windows): the dev build with loopMIDI, and Save after Open example asking for a location in the real app. Engine-level Save asking where is tested.
