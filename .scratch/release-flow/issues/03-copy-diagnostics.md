# Copy diagnostics

Status: ready-for-human

See spec, "Diagnostics".

## Fix

- `src/main/`: an IPC handler that gathers app version, Electron version, `os.release()`, and the log folder (`userData/logs`, see `src/main/log.ts`).
- Engine: Output statuses, MIDI Input status, Tempo source. They are already in the renderer's state through `useOutputs`, `useMidiInput` and the Tempo hook, so gather them there, not with a new engine command.
- Renderer: a "Copy diagnostics" entry (e.g. in the top bar's menu or the Sidebar footer). Build the text in a pure function, copy it to the clipboard, show a toast "Diagnostics copied".
- Preload: expose only this one call. Check it against the payload checks in `src/main/index.ts`.

## Acceptance

- Unit test for the text builder: all fields present, unknown values show as `unknown`, no file paths except the log folder.
- Manual check on Windows: paste into Notepad, read it through.
- `npm run check` passes.

## Comments

2026-10-10: agent part done. `diagnostics:appInfo` in main (app and Electron versions, `os.release()`, log folder), one preload call `window.diagnostics.appInfo()` with no payload. "Copy diagnostics" in the Sidebar footer, outside Perform; it adds the Outputs, MIDI ports and Input, and Tempo from the renderer's state and toasts "Diagnostics copied". Text built by `diagnosticsText` in `src/renderer/src/shell/diagnostics.ts`, unit tested. `useOutputs` is now undefined until the engine answers, so Outputs show `unknown` then. The bug template says where the button is. Left for the maintainer: on Windows, paste into Notepad and read it through. A failed Output's error is the serial port's own message and may name the COM device; that is a device, not a file.
