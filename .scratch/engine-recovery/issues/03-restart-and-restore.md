# Restart the engine and restore its state

Status: ready-for-agent

Blocked by: 02

See spec, "Restart and restore".

## Problem

After an unexpected engine exit, output stays dark and the UI is cut off until the app is restarted.

## Fix

- `src/main/index.ts`:
  - A quitting flag set on `before-quit`. Exits while quitting are expected.
  - On an unexpected exit: fork a new engine with `startEngine()`, re-send all path grants given so far (keep the list in main), send `{ type: 'restore', snapshot }`, then post a new MessagePort to the window, as `connectWindowToEngine` does.
  - Rate limit: at most 3 restarts in 60 s. After that, tell the renderer the engine is down for good.
  - `grantPath`, file dialogs and the close guard must use the current engine, not the first one.
- `src/engine/serve.ts`, `src/engine/engine.ts`: handle `restore`. Load the documents with their paths and unsaved state, then apply playback state and the MIDI Input. If that throws, fall back to the Base Look with Blackout and Grand Master kept. If that throws too, start empty. Reply on the parent port with the result: `restored`, `baseLook` or `empty`.
- Renderer: on reconnect after a restart, show the toast from the spec. When the engine is down for good, show a persistent error. Offer "Save Show as…" and "Save Venue Patch as…": main writes the documents from its snapshot, as JSON, to the chosen paths.
- ADR 0011, as in the spec.

## Acceptance

- Tests, with a fake engine process where needed:
  - An exit while quitting does not restart.
  - An unexpected exit restarts, re-grants paths, restores, reconnects.
  - The 4th exit within 60 s does not restart and reports engine down.
  - Restore brings back documents, unsaved state, active Scenes per Layer, Grand Master, Blackout, Freeze, mode, Tempo and MIDI Input.
  - A restore that throws falls back to Base Look, then to empty.
- Manual check on Windows with a DMX interface: kill the engine process in Task Manager during a Scene. Output comes back with the same look within about a second. Note the gap measured.
- The log shows the exit, the restart and the restore result.
- `npm run check` passes.
