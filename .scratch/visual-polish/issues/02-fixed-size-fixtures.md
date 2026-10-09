# Fixed screen size for Fixtures and grid labels

Status: resolved

See spec, "Stage plan sizes".

## Acceptance

- On the stage plan (`StagePlan`), Fixture markers are about 10 px across and Fixture labels about 11 px, at any stage size or window size. Selected and Overhead strokes scale with them.
- The Zone grid labels in `StageGrid` are fixed pixel sizes. They are shared by the plan and the Preview.
- The Preview (`Preview`) draws Fixture markers at the same size as the plan, from one shared constant.
- Positions, dragging, snapping, Zones and beam lines stay in metres. Dragging still lands where the pointer is.
- Resizing the window or changing the stage size keeps the sizes on screen the same.
- Tests: whatever jsdom can show (for example, the marker size follows the plan's scale). Check by eye in the running app with a small (4 × 3 m) and a large (16 × 10 m) stage, and three Fixtures in one Zone.

## Comments

### 2026-10-09 — implemented (agent)

The SVGs stay in metres. Things with a fixed screen size are drawn in a group scaled by `1 / pixels per metre`, and their insides are in px.

- `venue/pixelScale.ts`: the shared `FIXTURE_MARKER_RADIUS` (5 px), `LABEL_GAP` and `LABEL_ROOM`.
  - `pixelScale` is the pure fit, matching SVG's default `meet`.
  - `usePixelView` measures the SVG with a ResizeObserver. It returns pixels per metre and a view box padded by `LABEL_ROOM` (40 px), so the grid labels never clip at small scales.
  - `atPixels(x, y, scale)` is the group transform.
- `StagePlan`:
  - Fixture markers are 10 px across. Labels use `--text-xs` (11 px).
  - Marker strokes and the Overhead dash are 1.5 px, and 2.5 px when selected.
  - Dragging still uses the root SVG's CTM, in metres.
- `StageGrid`: the Zone grid labels use `--text-sm` (12 px) at a 6 px gap from the stage edge. It takes a `scale` prop.
- `Preview`: both views draw markers from the same constant and stroke weight.
  - Also changed: the front elevation's "Stage Right / Centre / Stage Left" labels are fixed px too, to match the top-down view.
- `ZonePicker` is unchanged (still in metres; out of scope).

Tests:
- `pixelScale.test.ts`
- `StagePlan.test.tsx`: the marker's on-screen size is 5 px on a 4 × 3 m and a 16 × 10 m stage, and the position stays in metres.
- A Preview test: both views match the plan's marker size.

Typecheck, lint and the full suite pass.

Not checked: the running app. Electron can't run in the dev container. Left for a human on the Windows host:

- A 4 × 3 m and a 16 × 10 m stage, three Fixtures in one Zone. Check that the markers and labels look the same size on both and that the labels don't collide.
- Resize the window and toggle the inspector. Sizes on screen stay the same.
- Dragging lands where the pointer is. The smaller (10 px) marker is still easy to grab.
- Grid labels ("Front", "Stage Left", …) are not clipped. Check the 40 px label room doesn't look too wide on a small stage.
- Show view and Perform Preview: markers match the plan.

Set to `resolved` once this is checked.

### 2026-10-09: resolved

Marked resolved by the user.
