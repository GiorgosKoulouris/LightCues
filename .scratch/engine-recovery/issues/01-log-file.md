# Rotating log file for main and the engine

Status: ready-for-agent

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
