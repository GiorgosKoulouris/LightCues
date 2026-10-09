# Toggle to hide Fixture labels

Status: resolved
Blocked by: 02

See spec, "Fixture labels".

## Acceptance

- An icon toggle in the Fixtures tab's action bar, next to the inspector toggle, with an accessible name and `aria-pressed`. Shown on the Fixtures tab only.
- Off hides the Fixture labels on the stage plan. The selected Fixtures and the dragged Fixture still show their labels. Every marker keeps its `<title>` tooltip.
- Remembered on this machine between runs, like the recent files. Not saved in the Venue Patch, and not on undo. Labels are shown on first launch.
- The Focus Check beams are not affected.
- Tests: the toggle hides and shows labels, the selected Fixture keeps its label, the setting survives a remount.

## Comments

### 2026-10-09: implemented (agent)

- `venue/usePlanLabels.ts`: the setting, in the window's `localStorage` (key `stagePlan.labels`). Shown unless it holds `false`. Read or write errors are logged, and labels stay shown.
- `StagePlan`: a `showLabels` prop. When false, a Fixture's `<text>` renders only if it is selected or being dragged. `<title>` always renders.
- `VenuePatchView`: an `IconButton` (Tag icon) named "Fixture labels" with `aria-pressed`. It sits before the inspector toggle, on the Fixtures tab only. It sends no `VenueEdit`, so there is nothing to undo.
- `ui/Button.module.css`: a pressed ghost icon button is accent-coloured. No other ghost button uses `aria-pressed`.
- The Focus Check beams are untouched. They are children of the plan.

Tests:
- `VenuePatchView.test.tsx`:
  - hides and shows labels, and tooltips stay
  - the selected Fixture keeps its label
  - the setting survives a remount, with no edits sent
  - the toggle shows on the Fixtures tab only
- `StagePlan.test.tsx`: the dragged Fixture shows its label while labels are hidden.

Typecheck, lint and the full suite pass. `format:check` flags only the untracked `fos-wash-led-quad-iii.json`, which is not part of this change.

Open decision:
- The spec says "like the recent files". Recent files live in an engine-written file under `userData`. This setting lives in renderer `localStorage`, which Electron also keeps under `userData`, so it still persists on this machine.
- `localStorage` is per origin, so the dev server and the packaged app each keep their own value.
- If it should sit next to the other machine settings in the engine, that needs a protocol command and a new file. Otherwise, consider an ADR line: view preferences live in renderer `localStorage`.

Not checked: the running app. Electron can't run in the dev container. Left for a human:
- Toggle off. Labels disappear. Selecting or dragging a Fixture shows its label. Hovering shows the tooltip.
- Restart the app. The setting is kept.
- The pressed and unpressed icon states are easy to tell apart.

Set to `resolved` once this is checked.

### 2026-10-09: resolved

Marked resolved by the user.
