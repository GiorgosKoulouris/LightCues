# Direct tests for movement Effects

Status: ready-for-agent

See spec. Glossary: Effect, Spread, Direction, Mounting, Tempo in `CONTEXT.md`. ADR 0007.

## Problem

`src/engine/movement-effects.ts` turns a base Direction, an Effect shape, size in degrees, length in beats and a Spread into pan/tilt over time. A mistake shows as a wrong move on the real rig. Only one Pan sweep case is checked, through `playback.test.ts`.

## Fix

`src/engine/movement-effects.test.ts` (new). Test the module's exported functions directly, with fixed beat positions and no timers. Cover:

- Each shape: Circle, Pan sweep, Tilt sweep, Ballyhoo. At beat 0, ¼, ½ and 1 of the length, the offset from the base aim matches the expected values. Size is in degrees, so a 10° sweep moves 10° whatever the Profile's pan range.
- Each Spread: In sync, Left→Right, Mirrored, Alternate. Offsets between Fixtures follow their stage positions. Two Fixtures at the same x get the same phase.
- Length: doubling it halves the speed at the same Tempo.
- Limits: a move past the Fixture's pan or tilt range is clamped, not wrapped. Check the behaviour the code has now and note it in the test name.
- Mounting: an inverted pan Fixture moves the mirror way. Hung vs Standing flips tilt as expected.
- A Fixture with only pan (or only tilt) uses the axis it has.

If a test finds a bug, fix it in the same issue and say so in the comments.

## Acceptance

- Coverage of `movement-effects.ts` (from `test-coverage/01`) before and after, in the comments.
- `npm run check` passes.
