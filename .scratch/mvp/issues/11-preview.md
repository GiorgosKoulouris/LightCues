# Preview: top-down and front elevation, Monitor and Blind

Status: ready-for-agent
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
