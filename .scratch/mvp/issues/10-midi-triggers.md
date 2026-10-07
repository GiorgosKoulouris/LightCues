# MIDI input and Triggers

Status: ready-for-agent
Blocked by: 07, 08

MIDI input in the engine process (@julusian/midi). Select the input port (rtpMIDI sessions appear as normal ports). Map channel + note to a Scene with mode Go (activate, stays on), Flash (active while held) or Release (clear the Layer). MIDI learn for mapping. On port loss: hold the current look and raise a warning.

## Acceptance

- Trigger behaviour is unit-tested with synthetic MIDI messages.
- Port loss and return are surfaced in the UI.

## Comments

### 2026-10-07: from issue 01

Whichever of 06 and 10 lands first adds the first native module. Add a `postinstall` step that rebuilds it for Electron on the Windows host (`docs/setup.md` §6). In the devcontainer, engine tests run under plain Node, so the module must stay built for Node there.

### 2026-10-07: from issue 06 (agent)

`serialport` landed first, with no `postinstall` rebuild: its binding ships N-API prebuilds that load in both Node and Electron (`docs/setup.md` §6). Check whether `@julusian/midi` does too. Add a rebuild step only if it does not.

### 2026-10-07: from issue 07 (agent)

`Trigger { channel 1–16, note 0–127, scene, mode: 'go' | 'flash' | 'release' }` in `src/shared/show.ts`. Release references a Scene and clears its Layer. `putTrigger` replaces the Trigger on the same channel and note, which suits MIDI learn.

### 2026-10-07: from issue 08 (agent)

Scene state lives in `ActiveScenes` (`src/engine/scene-resolution.ts`). Go calls `activate(active, show, sceneId, nowSeconds)`. Release calls `clearLayer(active, scene.layer)`, which is instant. Flash needs the Layer's previous Scene, to restore it on note-off. Keep that yourself, because `ActiveScene.from` is dropped once a fade ends. Then replace the engine's blackout `frame` (`engine.ts`) with `resolveFrames(show, patch, active, nowSeconds, grandMaster).get(universe)`. Resolve once per send tick, not once per Universe.

### 2026-10-07: from issue 09 (agent)

The engine holds the Show and the active Scenes: `src/engine/playback.ts` (`createPlayback`). Go and Release can go through its `goScene` / `clearLayer` handling. Flash still needs the Layer's previous Scene. Add Trigger edits (`putTrigger`, `removeTrigger`) to `ShowEdit` in `src/shared/protocol.ts` and `show-session.ts`. `resolveFrames` gets no Grand Master yet (always 1).
