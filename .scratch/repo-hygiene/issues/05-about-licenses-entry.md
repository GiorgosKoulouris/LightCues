# "About / Licenses" entry in the app

Status: resolved

From issue 04 (optional part, not done there).

## Problem

The installer ships `resources/THIRD_PARTY_NOTICES.txt` and `resources/LICENSE.txt`, but the app has no way to open them. Users must find the install folder.

## Fix

- An "About / Licenses" entry (sidebar or menu) that opens `THIRD_PARTY_NOTICES.txt` and `LICENSE.txt` from `process.resourcesPath`, through main (fixed paths only, no path from the renderer).
- Add a CHANGELOG line.

## Acceptance

- In the installed app, the entry opens both files.
- `npm run check` passes.

## Comments

2026-10-10 (agent): implemented. Left for you: the Windows acceptance check. Install a build, open **Licenses** in the sidebar, pick each item, and check Notepad (or the default .txt app) opens `LICENSE.txt` and `THIRD_PARTY_NOTICES.txt`. Then mark resolved. Verified here: `npm run check` passes; `dist/win-unpacked/resources` holds both files, which is `process.resourcesPath` in the packaged app. Electron can't launch in the devcontainer (no display), so `shell.openPath` was not run for real.

How it works:

- **Licenses** menu in the sidebar footer, outside Perform: "LightCues license" and "Third-party notices".
- `window.licenses.open('license' | 'thirdPartyNotices')` over `shell:openLicense`. Main maps the name to a fixed file in `process.resourcesPath` (`src/main/licenses.ts`) and refuses anything else. No path crosses from the renderer.
- If `shell.openPath` fails, main logs it and the renderer shows a toast. In `npm run dev` both fail: the files exist only in a packaged app.

Also in this change, from a user request: the sidebar footer lines up with the view items. "Check for updates" is a labelled button and "Check on startup" has its own row, so it no longer wraps.

2026-10-10: maintainer confirmed the remaining checks are done. Resolved.
