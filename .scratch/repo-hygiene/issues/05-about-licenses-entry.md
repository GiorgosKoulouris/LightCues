# "About / Licenses" entry in the app

Status: needs-triage

From issue 04 (optional part, not done there).

## Problem

The installer ships `resources/THIRD_PARTY_NOTICES.txt` and `resources/LICENSE.txt`, but the app has no way to open them. Users must find the install folder.

## Fix

- An "About / Licenses" entry (sidebar or menu) that opens `THIRD_PARTY_NOTICES.txt` and `LICENSE.txt` from `process.resourcesPath`, through main (fixed paths only, no path from the renderer).
- Add a CHANGELOG line.

## Acceptance

- In the installed app, the entry opens both files.
- `npm run check` passes.
