# Focus Check

Status: resolved
Blocked by: 02

See spec, "Live control".

## Acceptance

- The Venue Patch editor has a Focus Check control: off, or one of the six Directions.
- While on, every mover outputs the chosen Direction's aim, intensity full, white, shutter open, overriding the Show. Non-movers output as the Show resolves them.
- It is sent to the Outputs in Blind too. Blackout still wins.
- Edits to position, Mounting or Profile apply live while it is on.
- It turns off when the Venue Patch view is left, and on New/Open of a Venue Patch.
- The Focus Check state is not saved and not part of undo.
- Tests: engine output while on, in Blind, under Blackout, and after leaving the view.

## Comments

### 2026-10-08: implemented

- `src/shared/protocol.ts`: command `setFocusCheck` with an optional `direction`. Without one, it is off. The `playback` event carries `focusCheck` while it is on.
- `src/engine/playback.ts` owns the state, so it is not in the Venue Patch, its file or its undo history. `frames()` overlays the Focus Check on whatever would be sent: the resolved Show in Monitor, the held frames in Blind, the blacked-out frames under Blackout. The held frames themselves are not changed, so Blind holds the Show again once it ends. `venueReplaced()` turns it off.
- `src/engine/scene-resolution.ts`: `focusCheckFrames(patch, frames, direction, intensity)` sets every moving Fixture to white at `intensity`, aimed at the Direction. Shutter open and colour-wheel slots go through the same encoding as the Show. `levelOutput` is split out of `fixtureOutput` and shared.
- `src/engine/venue-session.ts`: a `replaced` hook, called after New and after a successful Open. A failed Open leaves the Focus Check on, since the patch did not change.
- Position, Mounting and Profile apply live, since frames are resolved from the current patch on every tick.
- `src/renderer/src/venue/VenuePatchView.tsx`: a "Focus Check" select in the view's actions bar, Off or one of the six Directions, on both tabs. An effect cleanup on `active` sends off when the view is left or unmounted. `usePlayback` now carries `focusCheck`.
- Tests:
  - `outputs.test.ts` "engine Focus Check": output while on, with the dimmer left to the Show; in Blind; under Blackout in Monitor and Blind; live position, Mounting and Profile edits; off on New and Open; not saved and not undone.
  - `VenuePatchView.test.tsx` "Focus Check": the picked Direction is sent, and off is sent when the view is left. "searches on Ctrl+F" now counts only Fixture options.
- `npm run check` green. Not tried in the running app or on a real rig.
- Open questions from review, not changed:
  - The Grand Master is ignored: movers go to full, and only Blackout wins. This follows "intensity full" literally. Confirm.
  - The aim uses the centre-nearest pan solution, not the pan the Show holds. A Fixture with more than 360° of pan may swing the long way when the check starts or ends.
  - The preview still shows the Show, not the Focus Check. It is not visible in the Venue Patch view, so this rarely matters.
