# Preview: top-down and front elevation, Monitor and Blind

Status: resolved
Blocked by: 05, 08

Render the engine's resolved state. Top-down: Fixtures coloured by output. Front elevation: stage seen from the audience, Fixtures at their height, beams as coloured cones. Monitor mirrors output; Blind resolves and previews without sending to Outputs.

## Acceptance

- Switching to Blind freezes Outputs at their current frame while the preview keeps updating.
- Preview rendering does not affect the engine send loop.

### 2026-10-07: from issue 05 (agent)

`src/renderer/src/venue/StagePlan.tsx` already draws the stage, the Zone grid and Fixtures top-down in metres (SVG, y flipped, Stage Left on the right). The preview's top-down view can reuse its geometry.

### 2026-10-07: from issue 08 (agent)

`resolveFrames` (`src/engine/scene-resolution.ts`) is pure. Blind can resolve frames for the preview and stop passing them to Outputs. It does not report per-Fixture colour. The preview either decodes frames per Profile, or needs a resolver step that exposes the combined intensity and colour levels per Fixture before encoding (`FixtureOutput` internally).

### 2026-10-07: from issue 09 (agent)

The Monitor/Blind mode is in the engine (`setMode`, `playback` event, `src/engine/playback.ts`). Blind holds the Outputs at the last frames sent. In Blind, `frames()` does not resolve at all, so the preview needs its own resolve path. The UI has a Monitor/Blind switch in the Show view.

### 2026-10-07: implemented on `dev` (agent, devcontainer)

Done:

- Resolver: `resolveLights` (`src/engine/scene-resolution.ts`) gives each Fixture its intensity and the colour it shows, by Fixture id. It shares one per-Fixture step with `resolveFrames`. Colour: the colour-wheel slot picked, the mixed colour on RGB Fixtures, or the average colour of fixed emitters (e.g. warm + cold white). White when no Rule sets colour.
- Engine:
  - `src/engine/preview.ts`: commands `startPreview` / `stopPreview`. While started, it sends a `preview` event (`lights: Record<id, FixtureLight>`) at once and whenever the look changes, checked at ~40 Hz on its own timer.
  - `playback.lights()` resolves in both modes. `frames()` is unchanged, so Blind still holds the Outputs at the last frames sent.
- UI: a Preview section in the Show view, under the Monitor/Blind switch.
  - Top-down: the stage plan (`StageGrid`, extracted from `StagePlan.tsx`) with each Fixture filled in its colour, by intensity.
  - Front elevation: from the audience, Stage Left on the right, Fixtures at their height. Overhead Fixtures beam down to the floor, Floor Fixtures beam up 3 m. Cones in the Fixture's colour, opacity by intensity. Upstage Fixtures are drawn first.

Acceptance:

- Blind freezes Outputs while the preview keeps updating: "keeps updating while Blind freezes the Outputs at their current frame" in `src/engine/outputs.test.ts`.
- Preview does not affect the send loop: the preview only reads state, on its own timer. Rendering runs in the UI process. "does not change the frames sent to the Outputs" compares every frame written by an engine with the preview on and one without it.

`npm test` (210), `typecheck`, `lint`, `format:check` and `build` pass. The UI was not run: the devcontainer has no display.

Open points for the user:

- Monitor is a close mirror, not byte-exact. The preview resolves the same state as the Outputs, but on its own tick (up to 25 ms apart during a fade), before 8-bit encoding. It also shows Fixtures whose Universe has no Output or whose Output failed as lit. The Outputs status shows those.
- Beams have no aim: down from Overhead, up from Floor. Directions come later.
- An RGB Fixture with no colour Rule shows white. On the rig its emitters stay at their Profile defaults, which may be dark.
- The Show view stays mounted when hidden, so the preview runs on every view.
- `startPreview` / `stopPreview` is one flag, not counted per window. Fine with one UI port.
- `FixtureLight` lives in `src/shared/protocol.ts`, so the pure resolver now imports a protocol type.

### 2026-10-07: closed open points (user)

- Monitor is a close mirror, not byte-exact. Accepted.
- No colour Rule: the Show now has a **Default Colour** (`Show.defaultColour`, White when absent), set in the Show view next to Base Look (`setDefaultColour` edit). The engine applies it to the rig, not only the preview, wherever no Rule sets colour: RGB Fixtures mix it, colour wheels pick the nearest slot. Before, those channels stayed at their Profile defaults, often dark. `.lcshow` is now version 2; version 1 files load with White. `ColourPicker` moved to `src/renderer/src/show/ColourPicker.tsx`. `CONTEXT.md` defines **Default Colour**. Done.
- The preview runs on every view. Accepted.
- Beams aim down from Overhead and up from Floor. Accepted for the MVP.
- One `startPreview` flag and `FixtureLight` in `protocol.ts`: no change.
- Not changed: a crossfade from a Scene without colour to one with colour still jumps to the new colour; it does not fade from the Default Colour.
