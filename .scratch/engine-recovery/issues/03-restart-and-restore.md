# Restart the engine and restore its state

Status: ready-for-human

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

Choices beyond the issue:

- The restart logic is in `src/main/engine-supervisor.ts`, Electron-free and tested with a fake engine. `index.ts` only wires it to Electron. Grants are recorded once the engine acks them.
- Main ignores a restarted engine's snapshots until it replies `restored`. Its start snapshot holds the reopened files on disk, so taking it would lose unsaved edits if the engine crashed during the restore. After replying, the engine sends its whole snapshot again.
- If there is no full snapshot yet, the engine restarts without a restore and the result is `empty`.
- Restore validates both documents, then resolves the look once (`frames` and `lights`), so a snapshot that breaks resolution throws during the restore and not later in the frame loop. `serve.ts` catches a throw from the last fallback and replies `empty`.
- The engine grants the snapshot's document paths to itself. Main re-grants only the paths it granted, not the recent files the engine reopened on launch.
- Playback comes back at once, without fades, in the same Layer order. A held Flash comes back as its Scene (a Go). The Focus Check is off. Freeze is on but holds the new engine's beat. A MIDI Clock Tempo comes back as `held`.
- The renderer is reconnected, not reloaded, so state the renderer holds, such as a Profile being edited, survives. The preload re-sends the last of each state request (`STATE_REQUESTS`) and the last preview start or stop to the new port (`src/preload/state-requests.ts`).
- Toasts: the two from the spec, plus "Engine restarted without the open Show and Venue Patch." for `empty`.
- Engine down: a persistent banner with "Save Show as…" and "Save Venue Patch as…". Main shows the Save dialog and writes `snapshotFile(...)`. While the engine is down, the close guard only warns ("Close Anyway" / "Cancel"), because the renderer's save flow cannot run.
- ADR 0011 written. ADR 0010 now points to it. `docs/setup.md` Troubleshooting covers restarts.

Left for a human:

1. Manual check on Windows with a DMX interface. Run `npm run package`, install and launch. Start a Scene, then end `LightCues Engine` in Task Manager. Output comes back with the same look, and the toast shows. Note the gap measured. Check the log for `Engine exited with code N`, `Restarting the engine` and `Engine restore result: restored`. End it 3 more times within a minute: the banner shows, and Save Show as… writes a file that opens.
2. Decide whether these differences from "restores playback state exactly" are acceptable: no fade in progress, Flash comes back as Go, Focus Check off, Freeze at the new beat.
3. Decide on the `empty` fallback. The empty engine then reports empty documents, so main's snapshot, and a later Save as from it, hold empty documents.
4. A crash in the frame loop after a successful restore repeats until the engine is down. Restore only falls back on a synchronous throw. Main could send the Base Look restore on the next attempt instead.

Then mark this issue resolved.
