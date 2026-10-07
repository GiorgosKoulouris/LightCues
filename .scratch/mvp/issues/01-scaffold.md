# Scaffold Electron app with separate engine process

Status: ready-for-agent

Set up Electron + TypeScript + React with the engine in an Electron utilityProcess. Define a typed message contract (commands UI → engine, state engine → UI). Add a test runner and lint.

## Acceptance

- App launches on Windows; engine process starts and replies to a ping.
- Engine code has no Electron/UI imports and runs standalone under the test runner.
