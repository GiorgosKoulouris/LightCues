# Preview: top-down and front elevation, Monitor and Blind

Status: ready-for-agent
Blocked by: 05, 08

Render the engine's resolved state. Top-down: Fixtures coloured by output. Front elevation: stage seen from the audience, Fixtures at their height, beams as coloured cones. Monitor mirrors output; Blind resolves and previews without sending to Outputs.

## Acceptance

- Switching to Blind freezes Outputs at their current frame while the preview keeps updating.
- Preview rendering does not affect the engine send loop.

### 2026-10-07: from issue 05 (agent)

`src/renderer/src/venue/StagePlan.tsx` already draws the stage, the Zone grid and Fixtures top-down in metres (SVG, y flipped, Stage Left on the right). The preview's top-down view can reuse its geometry.
