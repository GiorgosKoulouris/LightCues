# Speed limit in the engine

Status: resolved

See spec: Solution, and Implementation Decisions up to "Playback event".

## What to build

- The Speed limit constant and the pure fitting function in shared code.
- The held length per active movement Effect in playback: boundary switching and 90% hysteresis.
- Scene resolution runs each movement Effect at the length and size playback gives it.
- The `playback` event reports per Layer the limited length, emitted on change.
- CONTEXT.md **Speed limit** entry (and a mention under Effect), ADR 0015, CHANGELOG line.

## Acceptance

- Fitting function and playback tests from the spec's Testing Decisions pass.
- Shows that never reach the limit give the same frames as before.
- `npm test` and lint pass.

## Comments

Done. `fitSpeedLimit` in `src/shared/speed-limit.ts`, `SPEED_LIMIT` in `show.ts`. Playback holds a length and size per Effect and passes them to scene resolution as `EffectRuns`. The `playback` event has `limited`, a length per Layer, only while a Layer is limited. CONTEXT.md, ADR 0015 and a CHANGELOG line are in.

Choices the spec left open, or where the code differs from it:

- **Restarting a Scene that is still shown** (re-triggered, or A→B→A while A fades out) keeps its held length. It does not re-fit at once. The Scene it fades from has the same key, so a re-fit would make that copy jump at the start of the fade. A Scene that is not shown yet re-fits at once, as the spec says.
- **Show edits** to an Effect's shape, size or length re-fit at once, not at a boundary. The edit changes the look anyway.
- **Freeze** holds the size as well as the length, so an Effect shrunk at 16 beats does not move when the Tempo changes while frozen. When Freeze ends, the jump in beat is not a boundary. The next one is.
- **Switches land on the first frame after the boundary**, not on it exactly. The offset is at most one frame's movement.
- **A Tempo jump** leaves the Effect over the limit until the next boundary of its new length, up to 16 beats. ADR 0015 records this.

For issue 02: the `playback` event's `limited` field is ready. `usePlayback` does not pass it through yet.
