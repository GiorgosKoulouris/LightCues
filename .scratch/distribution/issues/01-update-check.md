# Update check

Status: resolved

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

## Comments

### 2026-10-09: implemented, manual check left

Done and covered by `npm run check`:

- `src/main/update-check.ts`: core with tests in `update-check.test.ts`. State in `update-check.json` in `userData`. `run()` resolves to the newer release (`UpdateAvailable`) or undefined.
- Main runs it 10 s after the first load. The renderer pulls the result over IPC (`updates:available`), so a reload still gets it. `shell:openReleasePage` opens only `isReleasePageUrl` URLs.
- Sidebar footer: the notice ("LightCues X.Y.Z is available", "Open release page"), hidden in Perform, the "Check on startup" checkbox, and a "Check for updates" icon button beside it. App tests cover all three.
- ADR 0012. README and `docs/agents/releasing.md` updated.

Choices beyond the issue:

- The last release found is remembered, so a launch within the day still shows the notice without a request.
- A failed check counts toward the daily limit, as the spec says "at most once a day". The release found earlier is kept.
- Turning the setting on mid-session checks from the next launch. Turning it off keeps a notice already shown.
- Added on request: the "Check for updates" button checks at once (`updates:checkNow`), whatever the setting or the daily limit, and counts toward that limit. It says "LightCues is up to date" or "Could not check for updates"; a newer release shows the notice.
- Code says "release page", not "release": in CONTEXT.md, Release is a Trigger action.

Left for a human: the manual check on Windows. Set `package.json` to a version below the latest release, run `npm run dev`, wait about 10 s. The notice shows outside Perform, hides in Perform, and the button opens the release page in the browser. Also try the check button with the startup check off. Then delete this issue.

### 2026-10-09: resolved

Marked resolved by the maintainer.
