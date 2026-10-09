# Stage views use their space

Status: ready-for-agent

See spec, "Stage views fit".

## Acceptance

- One view for the stage plan, the Preview's top-down view and the Zone pickers: the stage plus a 1 m Front row, grown to take in any Fixture outside them. No margin in metres. Labels keep their pixel room.
- Zone rows, snapping and Fixture Zones are unchanged: the Front row is still anything with y < 0.
- The audience plane is not drawn. The Focus Check no longer changes the plan's view.
- A beam that leaves the view is cut at its edge and ends in a small arrow. A beam that lands inside the view is drawn as before.
- Tests: the view fits the stage and Front row; it grows for a Fixture off stage; a beam past the view is cut at its edge with an arrow; the Focus Check keeps the view.
- Check by eye with a 3 × 4 m stage, a 16 × 10 m stage, and the Focus Check on.

## Comments

### 2026-10-09: implemented (agent)

- `stageView(stage, fixtures)` in `StagePlan.tsx` is the one view: the stage plus the 1 m Front row (`FRONT_DEPTH`), grown to take in the Fixtures. No margin. The `audience` option and `stageViewBox` are gone.
- The plan grows the view from the patch, not the dragged position, so the view holds still while dragging. A Fixture dropped off stage grows it after the drop.
- `BeamLines` takes the `view` and cuts each beam at its edge. A cut beam stops under a 0.4 × 0.3 m arrowhead in its colour, with its tip on the edge.
- The audience plane line and its CSS are removed. `audienceY` stays in `shared/aim.ts`: the engine still aims at it.

Tests: `stageView` fits the stage and Front row, and grows for Fixtures off stage; a Preview beam that lands inside has no arrow, one past the edge is cut with an arrow; the Focus Check keeps the plan's viewBox and draws the arrow. Marker size tests updated for the new scales. `npm run check` passes.

Not checked in the running app. Left for a human: a 3 × 4 m and a 16 × 10 m stage, how much more of the column the plan now fills; Focus Check arrows read clearly; the Preview with Audience/Out aims.
