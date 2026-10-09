# App icon

Status: resolved

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

## Implemented (2026-10-09)

Glyph: option D, "truss of three" (a bar with three beams), chosen by the maintainer from six drafts.

Choices beyond the issue:

- `npm run icon` runs `scripts/make-icon.mjs`. It renders the SVG with `@resvg/resvg-js` (dev dependency, prebuilt, no install scripts) and packs the PNGs with a small tested encoder, `scripts/make-icon/ico.mjs`. Each `.ico` entry is a PNG.
- Colours come from `tokens.css`: `--surface-1` background, `--accent` and `--accent-hover` beams, `--text` bar.
- `BrowserWindow` gets the icon only when not packaged. The packaged exe carries it already.
- `win.icon` only. NSIS defaults the installer and uninstaller icons to it.

Left for a human:

1. `npm run package` needs Wine on Linux, so it was not run here. On Windows: package, install, and check the installer, uninstaller, Start menu entry, taskbar and title bar show the icon.
2. Check it reads at 16 px with small taskbar icons on. The bar is about 1 px high at that size.
3. `npm run dev` on Windows: the window shows the icon.

Then mark this issue resolved.

### 2026-10-09: resolved

Checked by the maintainer on Windows: the installer, uninstaller, Start menu entry, taskbar and title bar show the icon, and it reads at 16 px.
