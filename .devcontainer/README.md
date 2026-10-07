# Devcontainer

For engine and logic work: models, Scene resolution, frame encoding, Trigger logic, tests, lint.

Not for: running the Electron app, USB DMX Outputs, rtpMIDI, or Windows packaging. Do those on the Windows host with its own `npm install`.

`node_modules` is a named Docker volume, so Linux and Windows native builds stay separate.
