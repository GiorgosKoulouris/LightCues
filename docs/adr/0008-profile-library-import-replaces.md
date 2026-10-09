# Profile Library import replaces the library, after a backup

Importing a library file replaces the whole Profile Library with the file's valid Profiles. It doesn't merge. Invalid Profiles and duplicate ids are skipped and listed in the confirm dialog before anything changes. A file with nothing valid is rejected outright, so an empty or broken file can't wipe the library. Before replacing, the current library is backed up automatically to `userData/backups/`, keeping the last 10. A failed backup stops the import. Restoring means importing a backup; there is no separate Restore UI. The engine swaps the library live, so no restart is needed. Venue Patches embed their Profiles and are unaffected.

## Considered Options

- Merge with per-Profile conflict rules: keeps existing Profiles, but needs a clash policy and UI, and can't reproduce a library exactly. It could come later.
- All-or-nothing validation: safer for exact copies, but one bad Profile from an old or hand-edited file blocks the whole import.
- Asking where to save the backup: more control, but one more dialog on every import, and users would lose track of backups.
