# Fixed screen size for Fixtures and grid labels

Status: ready-for-agent

See spec, "Stage plan sizes".

## Acceptance

- On the stage plan (`StagePlan`), Fixture markers are about 10 px across and Fixture labels about 11 px, at any stage size or window size. Selected and Overhead strokes scale with them.
- The Zone grid labels in `StageGrid` are fixed pixel sizes. They are shared by the plan and the Preview.
- The Preview (`Preview`) draws Fixture markers at the same size as the plan, from one shared constant.
- Positions, dragging, snapping, Zones and beam lines stay in metres. Dragging still lands where the pointer is.
- Resizing the window or changing the stage size keeps the sizes on screen the same.
- Tests: whatever jsdom can show (for example, the marker size follows the plan's scale). Check by eye in the running app with a small (4 × 3 m) and a large (16 × 10 m) stage, and three Fixtures in one Zone.
