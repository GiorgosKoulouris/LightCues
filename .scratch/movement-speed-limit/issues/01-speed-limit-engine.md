# Speed limit in the engine

Status: ready-for-agent

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
