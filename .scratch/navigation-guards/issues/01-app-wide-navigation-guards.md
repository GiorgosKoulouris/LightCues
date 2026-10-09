# App-wide navigation and new-window guards

Status: ready-for-agent

Found by the security scan's `electron-missing-navigation-guards` rule (security-scan issue 05) at `src/main/index.ts:194`.

## Problem

The main window has the preload bridge (`engine`, `dialogs`, `closeGuard`) and no navigation guards.

- No `setWindowOpenHandler`: a `target=_blank` link or `window.open` opens a new Electron window with default settings.
- No `will-navigate` guard: a link or redirect can move the window, with its preload API, to any page.

The renderer has no links and no `window.open` today, so nothing legitimate needs either. Any navigation or new window would come from injected content, such as a crafted show, venue or library file reaching the DOM.

## Fix

One handler for every window, as Electron's security checklist recommends (items 13 and 14). In `src/main/index.ts`:

- `app.on('web-contents-created', (_event, contents) => { … })`, registered before the first window is created.
- `contents.setWindowOpenHandler(() => ({ action: 'deny' }))`.
- `contents.on('will-navigate', (event, url) => { … })`: `preventDefault()` unless `url` is the app's own page. That is the renderer `index.html` file URL in a packaged build, and the `ELECTRON_RENDERER_URL` origin in dev.

## Acceptance

- The handler above is in `src/main/index.ts`, with a short comment on why.
- The allow check for the app's own page is a small pure function with unit tests: the packaged file URL, the dev server origin, and a foreign URL, `file:` path and `javascript:` URL that are all denied.
- Dev mode still works: Vite reloads (HMR and full reload) are not blocked.
- `semgrep scan --metrics=off --config security/semgrep src/` no longer reports `electron-missing-navigation-guards`. If the rule still flags a correct guard, fix the rule (`security/semgrep/electron.yml` plus a fixture case), don't suppress.
- `npm run check` passes.
