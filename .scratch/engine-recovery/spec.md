# Engine recovery

Batch 1 of the 2026-10-09 repo plan. Comes first because it protects real gigs.

Today, if the engine utilityProcess exits, main logs `Engine exited with code N` to the console and nothing else happens. DMX output stops. The open Show and Venue Patch live only in the engine, so unsaved edits are lost. Logs go to the console only, so a crash at a gig leaves no trace.

## Scope

1. A rotating log file for main and the engine (issue 01).
2. The engine reports a state snapshot to main (issue 02).
3. Main restarts the engine after an unexpected exit and restores the snapshot (issue 03).

Out of scope: undo history across a restart, crash reporting to a server, restarting main itself.

## Decisions (2026-10-09)

### Logs

- One log file per day in `%APPDATA%\LightCues\logs\`, named `lightcues-YYYY-MM-DD.log`. Keep the last 14 days.
- Main writes its own lines. It also captures the engine's stdout and stderr (`utilityProcess.fork` with `stdio: 'pipe'`) and prefixes them with `[engine]`.
- Each line starts with an ISO timestamp. No document contents, no file contents. File paths are allowed.
- Log on engine start, exit (with code), restart, restore result, and every error that reaches `serve.ts`'s catch.

### Snapshot

- The engine sends `{ type: 'snapshot', ... }` to main on the parent port. Main keeps only the latest one, in memory. Nothing goes to disk.
- Contents: the current Show and Venue Patch documents, their paths and saved/unsaved state, the active Scene per Layer, Grand Master, Blackout, Freeze, playback mode, Tempo and its source, and the selected MIDI Input.
- Documents are sent when they change. Playback state is sent on change, throttled to at most every 100 ms. One message type carries both, with the parts that changed.
- Undo history is not in the snapshot. It is lost on a restart.

### Restart and restore

- An exit counts as unexpected unless main is quitting. Main sets a flag on `before-quit`.
- Main restarts the engine at once. At most 3 restarts in 60 s. After that it stops trying and the renderer shows a persistent error: "The engine keeps crashing. Save your work and restart LightCues." (Save goes through the snapshot, see issue 03.)
- After the new engine spawns, main re-sends every path grant it gave before, then sends `{ type: 'restore', snapshot }`, then reconnects the window with a new MessagePort.
- The engine restores the documents, marks them unsaved if they were, restores playback state exactly, and re-selects the MIDI Input. Outputs reopen through their normal scan.
- If restore fails (e.g. the snapshot itself caused the crash), the engine starts with the same documents but goes to the Base Look, with Blackout and Grand Master as they were. If that also fails, it starts empty.
- The renderer shows a toast: "Engine restarted. Output resumed." Or, after a fallback: "Engine restarted in Base Look."
- Record as ADR 0011: why main holds the snapshot, why playback is restored and not blacked out.

## Order

01, 02, 03. 03 needs 02.
