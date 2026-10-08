# Report approximated aims

Status: resolved
Blocked by: 02

The Venue Check does not exist yet. This issue exposes the data it will need and shows it where the operator fixes it.

## Acceptance

- A pure function lists, for a Show + Venue Patch, every mover × Direction used by the Show (Rules and the Default Direction) whose aim is approximated, with the reason: assumed pan/tilt range, out of reach, missing axis.
- The Fixture Inspector shows a warning on a mover with approximated aims, naming the Directions and reasons. An assumed range points to the Profile editor.
- Tests for each reason.

## Comments

### 2026-10-08: implemented

- `src/shared/aim.ts`: `Aim.approximated` is now `Aim.approximations`, a list in `APPROXIMATIONS` order: `assumedPanRange`, `assumedTiltRange`, `outOfReach`, `missingAxis`. Empty means exact.
  - `missingAxis`: off target even before clamping, so a lacking axis is the cause. It is never paired with `outOfReach`.
  - `outOfReach`: on target unclamped, off target once clamped to the range.
- `aim.ts` and `dmx-point.ts` moved from `src/engine` to `src/shared`, so the renderer can run them. `ruleTargets` moved from Scene resolution to `src/shared/show.ts`.
- `src/shared/venue-check.ts`: `approximatedAims(show, patch)` and `fixtureApproximatedAims(show, patch, fixture)`. A moving Fixture is checked at the Default Direction and at the `direction` of every Rule that targets it. Results come in patch order, then Direction order. These are the makings of the Venue Check.
- Fixture Inspector: one moving Fixture shows "Approximated aims", one line per Direction with its reasons. When a range is assumed, it adds "Add the pan/tilt degrees to its Profile in the Profile editor." Nothing shows without a Show.
- Tests: `aim.test.ts` (each reason, both assumed, tilt alone, assumed plus out of reach, out of reach vs missing axis on a one-axis Fixture), `venue-check.test.ts` (each reason, Default Direction, Rule targeting, order, non-movers), `VenuePatchView.test.tsx` (warning text, axes named, non-mover). `npm run check` green. Not tried in the running app.
- Open gap: a Venue Patch keeps its own copy of each Profile. Adding degrees in the Profile editor does not reach the patch's copy, so the warning stays. Following the hint needs a way to refresh a patch's Profile copy from the library. That is not in any issue yet.
- Assumed ranges are flagged on every Direction, Down included, as spec.md says.
