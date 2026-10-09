# Main grants file paths, the engine checks them

The engine reads and writes only paths the user picked in a native file dialog. Main shows every dialog, so after a dialog returns a path, main sends `{ type: 'grantPath', path }` to the engine on the parent port. The engine checks the grant on `openVenue`, `saveVenue`, `openShow`, `saveShow`, `exportLibrary` and `previewLibraryImport`. An ungranted path fails with the command's normal error and nothing is read or written. The engine also trusts the paths it already holds: the current Venue Patch and Show files (granted when opened or saved) and the recent-files reopen paths. Paths match after `path.resolve`, case-insensitively, as on Windows. Grants last for the engine's lifetime, so a window reload keeps them. After a crash, main grants a restarted engine every path again, and while the engine is down main writes the documents itself (ADR 0011).

One grant needs no dialog: **Open example** asks main for the example Venue Patch and Show, and main grants the two fixed paths in `resources/examples` (the repo's `examples/` in development). The renderer cannot choose them. It opens them as new, so the engine keeps no path and Save asks where. A grant allows writes too, so an injected renderer could overwrite those two example files. They hold nothing of the user's and an update replaces them.

Main returns the path to the renderer only after the engine acks the grant on the parent port. The renderer sends its commands on its own MessagePort to the engine, and the parent port and the UI port have no ordering between them. Without the ack, a fast `openShow` could reach the engine before its grant and fail.

## Considered Options

- Check paths in main by routing file commands through it: main would see every path, but UI traffic would pass through main again, which the window's direct MessagePort to the engine avoids.
- Main reads and writes the files itself and passes contents: no paths reach the engine, but file handling splits across two processes, and the engine's recent files and atomic writes move with it.
- Restrict paths by folder or extension in the engine: needs no main changes, but still lets injected content read or overwrite any matching file.
- Grant without an ack: simpler, but racy, as above.
