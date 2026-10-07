# Electron with a separate engine process

LightCues is built with Electron and TypeScript. The engine (MIDI in, Scene resolution, DMX out) runs in its own Node process; the UI only sends commands and receives state. The developer is strongest in web tech, three.js makes the planned 3D view cheap, and DMX timing is handled in hardware by Enttec-protocol interfaces, so native code buys little. Isolating the engine keeps UI stalls (GC, rendering) from delaying output.

## Considered Options

- C#/.NET + WPF: solid fit, but a new stack for the developer and weaker 3D.
- Tauri: smaller footprint, but puts the engine in Rust.
