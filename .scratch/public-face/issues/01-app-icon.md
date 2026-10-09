# App icon

Status: ready-for-human

See spec, "Icon". You draw the glyph, or approve a draft. The wiring is agent work.

## Fix

- `build/icon.svg` (new): the source. Keep it simple enough to read at 16 px.
- `build/icon.ico`: 16, 24, 32, 48, 64, 128, 256 px, generated from the SVG with a script (`scripts/make-icon.mjs`). Commit the `.ico`, so packaging doesn't need the converter.
- `electron-builder.yml`: `win.icon: build/icon.ico`. Check the NSIS installer and uninstaller pick it up.
- `src/main/index.ts`: `BrowserWindow` `icon` for dev runs.
- README header: the SVG at about 64 px.

## Acceptance

- Installer, Start menu entry, taskbar and window title bar show the icon on Windows.
- Readable at 16 px (taskbar small icons).
- `npm run check` passes.
