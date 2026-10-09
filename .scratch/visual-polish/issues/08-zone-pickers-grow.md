# Rule Zone pickers grow with their column

Status: ready-for-agent
Blocked by: 07

See spec, "Rule Zone pickers".

## Acceptance

- Each Zone picker fills its share of the width, at true scale, no taller than about 320 px. A deep stage does not push the Roles panel far down.
- The "Audience" label is a fixed pixel size, as on the plan.
- Fixtures off stage show, as on the plan.
- Check by eye with a 3 × 4 m and a 16 × 10 m stage, at 1280 px and wider.

## Comments

### 2026-10-09: implemented (agent)

- Each plan uses `stageView` with every Fixture, so Floor and Overhead match the plan and each other.
- The plan's figure grows from 200 px, capped at `--plan-max-height` (320 px) times the view's aspect ratio, passed in as `--aspect`. So a deep stage gets a narrower plan, not a taller one.
- The "Audience" label and the Fixture dots are fixed pixel sizes, via `usePixelView`, with 24 px of label room.

Not checked in the running app. Left for a human: the pickers at 1280 px and wider, with a 3 × 4 m and a 16 × 10 m stage; the Roles panel stays beside or below them sensibly.
