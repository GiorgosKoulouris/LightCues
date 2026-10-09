# Main holds the engine's snapshot and restores the live look

If the engine process exits while the app is not quitting, main starts a new one at once. The engine sends main a snapshot of its state on the parent port: the whole of it on start, then each part when it changes. The parts are the open Show and Venue Patch with their paths and unsaved state, the active Scene per Layer, Grand Master, Blackout, Freeze, the mode, the Tempo and its source, and the selected MIDI Input. Main keeps only the latest, in memory. After a restart, main re-sends every path it granted, sends the snapshot to restore, then gives the window a new port. Undo history is not kept. Main ignores a restarted engine's snapshots until it replies to the restore, so a crash during the restore leaves the last good snapshot in place; the engine then sends its whole snapshot again.

Main holds the snapshot because it outlives the engine and already sits between the engine and the window. Nothing goes to disk: the documents stay unsaved until the user saves them, as they were, and no copy is left behind in `userData`.

Playback is restored as it was, not blacked out. A crash mid-show should cost the audience a blink, not a dark stage until someone finds the right Scene. The look comes back at once, without fades, with the Layers stacked in the same order. A held Flash comes back as its Scene, and the Focus Check is off. A Tempo from MIDI Clock is held until the clock ticks again.

A snapshot can itself be the cause of the crash. The engine resolves the restored look once before it replies, so a snapshot that breaks resolution fails there, not in the frame loop. It then falls back to the same documents with the Base Look, keeping Blackout and the Grand Master as they were, and failing that, it starts empty. Main allows 3 restarts in 60 s. After that the engine stays down, the renderer says so, and main can save the documents from its snapshot through a Save dialog.

## Considered Options

- The engine writes the snapshot to disk: it survives a crash of main too, but leaves copies of the documents on disk, and the write would sit in the engine's frame loop.
- Restart into Blackout: safer if the snapshot is bad, but turns every crash into a dark stage. The fallback chain covers a bad snapshot instead.
- Restart without restoring: simple, but the open documents and the live look are lost.
- Reload the window after a restart: refreshes every view for free, but loses the renderer's own state, such as a Profile being edited. The preload re-sends the views' state requests instead.
