# The engine reports a state snapshot to main

Status: resolved

See spec, "Snapshot".

## Problem

The open documents and the live look exist only in the engine. When it exits, there is nothing to restore from.

## Fix

- `src/shared/protocol.ts`: an `EngineSnapshot` type and a parent-port message `{ type: 'snapshot', ... }`. The message holds only the parts that changed: `show`, `venue` (each with document, path, unsaved) and/or `playback` (active by Layer, Grand Master, Blackout, Freeze, mode, Tempo and source) and/or `midiInput`.
- `src/engine/engine.ts` and `src/engine/serve.ts`: send a snapshot part on the parent port whenever that part changes. Throttle playback parts to at most one every 100 ms, always sending the latest. Send a full snapshot once on start.
- `src/main/` (new `engine-snapshot.ts` or similar): merges parts into the latest full snapshot. Electron-free, so it is testable.

## Acceptance

- Tests:
  - Each Show edit, Venue edit, open, save and undo sends the changed document part, with the right unsaved flag.
  - Go, Release, Flash, Grand Master, Blackout, Freeze, mode and Tap Tempo send a playback part. A burst of Grand Master moves sends at most one part per 100 ms, and the last one wins.
  - The merge in main keeps the latest of each part.
- Snapshots never go to disk.
- Measure on a large Venue Patch (e.g. 200 Fixtures with embedded Profiles) that a document part doesn't delay frames. Note the size and the time in the comments.
- `npm run check` passes.

Choices beyond the issue:

- The snapshot types are in `src/shared/protocol.ts`: `EngineSnapshot`, `DocumentSnapshot`, `PlaybackSnapshot` and `EngineSnapshotMessage`. `playback.active` is a list of `{ layer, scene }`, first activated first, so Layers stack in the same order after a restore.
- `src/engine/snapshot-reporter.ts` decides what to send. The engine passes every event it emits through it: `show`, `venue`, `playback`, `tempo` and `midiInput` events mark their part changed. A document part goes only when the document, its path or its unsaved state differ from the last one sent, so `getShow` and friends send nothing. Playback parts are throttled: the first goes at once, then the latest at the end of each 100 ms.
- Nothing is reported before the full snapshot. `serve.ts` sends that right after creating the engine.
- Main merges parts in `src/main/engine-snapshot.ts`. It has no snapshot until all four parts have arrived.

## Comments

### 2026-10-09: measurement

Measured with a 200-Fixture Venue Patch in 8 Universes, using the four profiles in `fixtures/GeneratedForImports`. Time is `v8.serialize`, the structured clone that `postMessage` uses, on the dev container.

| Venue Patch | JSON | Structured clone | Serialize per part |
| --- | --- | --- | --- |
| 200 Fixtures, 4 embedded Profiles | 78 KB | 47 KB | 0.15 ms |
| 200 Fixtures, 200 distinct embedded Profiles (worst case) | 2.6 MB | 1.2 MB | ~4.5 ms |

Frames go out every 25 ms, so even the worst case fits in one frame interval. Each venue edit already sends the same patch to the UI port, so a snapshot part about doubles the cost of an edit. Document parts are not throttled, as the spec says. A stage-plan drag with 200 distinct Profiles could add up to about 5 ms of jitter per frame. Throttle document parts too if that shows on real hardware.
