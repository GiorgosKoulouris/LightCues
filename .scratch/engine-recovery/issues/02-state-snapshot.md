# The engine reports a state snapshot to main

Status: ready-for-agent

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
