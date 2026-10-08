# Aim movers at a Direction

Status: resolved
Blocked by: 01

See spec, "Directions", "Aim computation", "Combining and timing".

## Acceptance

- `DIRECTIONS` (Down, Audience, Up, Cross, Centre, Out) in the shared Show model. `Rule` gains an optional `direction`.
- `Show` gains an optional `defaultDirection`. Absent means Down. The Show settings that edit the Default Colour also edit it.
- A pure aim module: given a Fixture (stage position, Mounting), its mode's pan/tilt channels and degree ranges, the stage bounds and a Direction, returns pan/tilt DMX values (coarse and fine) and whether the aim is approximated (assumed ranges, clamped, missing axis). Mounting inverts and offsets apply.
- Of the valid pan solutions, the one nearest a given current pan is picked. Without a current pan, the one nearest the range centre.
- Scene resolution sets pan/tilt for every mover: the `direction` of the last-changed Scene whose Rule targets it, else the Default Direction. Non-movers are unchanged.
- No fade yet: the new aim applies at activation (issue 04 adds the fade).
- The Scene editor's Rule row gets a Direction picker (none + the six).
- `.lcshow` version bump. Older files load without `direction` and `defaultDirection`.
- Tests for the aim module, with known geometry per Direction: Hung and Standing, rotated 90° and 180°, inverted, offset, missing ranges, unreachable aims, pan-only and tilt-only Fixtures, 16-bit channels. Resolution tests for "last changed wins" and the Default Direction.

## Comments

### 2026-10-08: implemented

- `src/shared/show.ts`: `DIRECTIONS`, `Direction`, `DEFAULT_DIRECTION` (Down), `Rule.direction`, `Show.defaultDirection`, `setDefaultDirection`. Validation rejects an unknown Direction in a Rule or as the default.
- `src/engine/aim.ts`: `aimAt({ position, mounting, channels, stage, direction, currentPan? })`. Returns `undefined` for a Fixture without pan or tilt. Otherwise `{ pan?, tilt?, approximated, dmx }`. `pan`/`tilt` are channel degrees from the centre of the range, after invert and offset. `dmx` maps mode channel offset to value, coarse and fine.
- Conventions:
  - Positive pan turns right-handed about the yoke axis (base toward head). That is clockwise from above when Hung, anticlockwise when Standing.
  - Rotation turns the base front clockwise seen from above, so 90° faces Stage Right. The Fixture Inspector hint now says so.
  - Physical angle = ±channel + offset.
  - A missing axis sits at channel 0. Its physical angle is then its offset, so a pan-only Fixture's tilt comes from its tilt offset.
- Choosing a solution: the smallest angle error wins. Among those within 0.01°, the pan nearest `currentPan` wins, or the range centre. A tie goes to tilt toward the front of the base. Where pan does not change the aim (beam along the yoke axis), the current pan is kept.
- Approximated means: off by more than 0.01° (clamped, or needs a missing axis), or degrees assumed (540°/270°).
- `src/engine/dmx-point.ts`: `Point`/`toDmx` moved out of Scene resolution so the aim module shares them.
- Scene resolution: for each moving Fixture (`isMovingFixture`), the `direction` of the last-changed Scene that sets one, else the Default Direction. Later Rules in a Scene override. During a fade the new Direction applies at once. Non-movers are untouched.
- Scene resolution does not pass `currentPan` yet. Every aim picks the solution nearest the range centre. Issue 04 should wire the current pan in. `approximated` is dropped there for now (issue 03).
- `.lcshow` is version 4. Versions 1–3 load. A v3 file with `direction`/`defaultDirection` is rejected as an unknown field.
- UI: a Direction select on each Rule card ("Not set" + six). A Default Direction select in Show settings, showing Down when absent. New engine edit `setDefaultDirection`.
- Tests: `aim.test.ts` (each Direction; Hung/Standing; 90°/180°; inverts; offsets; current pan; missing ranges; unreachable; pan-only; tilt-only; 16-bit; reversed range), `scene-resolution.test.ts` (Default Direction, last changed wins, Rule order, no fade), `show-file.test.ts` (v4 round trip, v3 load), `show.test.ts`, `engine.test.ts`, `ShowView.test.tsx`. `npm run check` green. Not tried in the running app or on a real rig.
- Review follow-up: the coarse/fine byte split is now one helper, `dmxByte` in `dmx-point.ts`. `aimAt` picks its solution through `beats`, which has named fields.

