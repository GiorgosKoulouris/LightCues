# Package a Windows installer

Status: needs-triage

Produce a Windows installer so operators can install LightCues without Node or build tools. See spec.

- Add a packager (electron-builder is the likely choice) and an `npm run package` script.
- Include the native module prebuilds for win32-x64 and check they load in the packaged app.
- App name, icon, version from `package.json`.

## Open questions

- Installer type: NSIS installer, portable exe, or both?
- Code signing: needed to avoid SmartScreen warnings? Which certificate?
- Auto-update: wanted? If so, where are releases hosted?
- Where do user files (Profile Library, Shows, Venue Patches) live after install?

## Acceptance

- `npm run package` on Windows produces an installer.
- The installed app starts, shows "Engine replied in N ms", lists MIDI and serial ports.

## Comments
