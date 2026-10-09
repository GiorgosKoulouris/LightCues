# Update check

Status: ready-for-agent

See spec, "Update check".

## Fix

- `src/main/update-check.ts` (new): Electron-free core. Takes the current version, a fetch function and a clock. Calls `https://api.github.com/repos/GiorgosKoulouris/LightCues/releases/latest`, reads `tag_name` and `html_url`, compares semver, returns `{ newer: true, version, url }` or `{ newer: false }`. Keep the last-checked time and the setting in a small JSON in `userData` (like `recent-files.json`).
- `src/main/index.ts`: run the check about 10 s after the window loads, if enabled and not checked in the last 24 h. Send the result to the renderer over IPC. An IPC call opens the release URL with `shell.openExternal`, only if it starts with `https://github.com/GiorgosKoulouris/LightCues/releases/`.
- Renderer: a quiet notice in the top bar or Sidebar, hidden while in Perform. A setting "Check for updates" (on/off).
- CSP and navigation guards stay as they are: the request is made by main, not the renderer.
- ADR 0012.

## Acceptance

- Tests for the core: newer, same, older, prerelease tag ignored, malformed response, network error (silent, logged), 24 h throttle, disabled setting makes no request.
- Test that the open-URL handler rejects any other URL.
- Manual check on Windows with a lower `package.json` version: the notice shows outside Perform, and the button opens the browser.
- `npm run check` passes.
