# Rotating log file for main and the engine

Status: resolved

See spec, "Logs".

## Problem

Main and the engine log only to the console. A packaged app has no console, so a crash at a gig leaves nothing to read.

## Fix

- `src/main/log.ts` (new): opens today's file in `app.getPath('userData')/logs/`, appends timestamped lines, deletes files older than 14 days on start. Keep the file logic Electron-free and testable: take the folder and a clock as arguments.
- `src/main/index.ts`: log engine spawn, exit with code, and main's own errors. Fork the engine with `stdio: 'pipe'` and pipe `engine.stdout` and `engine.stderr` into the log, line by line, with an `[engine]` prefix. Keep writing to the console too, for `npm run dev`.
- `src/engine/serve.ts`: the catch around `engine.handle` already logs. Make sure it uses `console.error`, so the message reaches the log.

## Acceptance

- Tests for `log.ts`: file name per day, line format, retention removes only files older than 14 days and only `lightcues-*.log` files.
- In a packaged build on Windows: the log file exists after a launch and holds the engine start line.
- No document or file contents in any log line. Search `src/` for `console.` calls that print documents.
- README Troubleshooting (or docs/setup.md for now) says where the logs are.
- `npm run check` passes.

Choices beyond the issue:

- Retention keeps the last 14 days, today included: on 10-09, files from 09-26 on stay.
- File names use the local date. Each line starts with local time in ISO 8601 with its UTC offset, e.g. `2026-10-09T14:30:05.007+03:00`. Every line of a multi-line message (a stack trace) gets its own timestamp.
- Writes are synchronous, so the last lines before a crash are on disk. A failed write is ignored; the log never stops the app.
- `JSON.parse` errors quote part of the input. The three startup `console.error` calls for an unreadable Profile Library, MIDI Input selection or recent files now log "The file is not valid JSON." instead (`src/engine/log-safe.ts`). The unsupported Profile Library version error quotes the version only when it is a number.
- Main logs `LightCues <version> starting`, unhandled rejections, and uncaught exceptions (through `uncaughtExceptionMonitor`, so Electron's own handling stays). The update check's errors go to the log too.
- `serve.ts` already used `console.error`; no change.
- Logs are documented in `docs/setup.md` Troubleshooting.

Left for a human: the packaged build on Windows. Run `npm run package`, install, launch, then close. `%APPDATA%\LightCues\logs\lightcues-<today>.log` exists and holds `LightCues <version> starting`, `Engine started (pid N)` and `Engine exited with code N`. Then mark this issue resolved.

### 2026-10-09: resolved

Packaged build checked on Windows by the maintainer: the log file exists after a launch and holds the engine start line.
