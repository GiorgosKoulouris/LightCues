# MIDI input and Triggers

Status: resolved
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

### 2026-10-07: implemented on `dev` (agent, devcontainer)

Done:

- Native module: `@julusian/midi` ships N-API prebuilds (win32-x64 included), like `serialport`. No `postinstall` rebuild. Added to `allowScripts`; its install script only checks the prebuild. `docs/setup.md` §6 and §8 updated.
- Engine:
  - `src/engine/midi-ports.ts`: the only file that loads `@julusian/midi`. Opens ports by name.
  - `src/engine/midi-input.ts`: the selected input. Lists ports every second. A selected port missing from the list is `lost`; it is reopened when it returns. A port that does not open is `failed` and retried. Commands `listMidiInputs`, `selectMidiInput`. Event `midiInput` (`ports`, `selected`, `state`, `error`).
  - `src/engine/playback.ts`: `fire(trigger)` on note-on, `noteOff(note)`. Go activates. Release clears the Scene's Layer. Flash activates and keeps what the Layer held. The note-off that started it puts that back exactly, as a cut. It works whatever the Trigger is by then. A Go or Clear on the Layer while it is held cancels the restore. So does a Show edit that removes the held Scene. Overlapping Flashes on one Layer: the latest wins, and releasing it restores the Scene from before both.
  - MIDI learn: `learnTrigger` / `cancelLearn`. The next note-on is sent as `triggerLearned` and not fired. Note-offs still release Flashes.
  - On port loss nothing changes in playback, so the look holds, held Flashes included.
  - `ShowEdit` gains `putTrigger` and `removeTrigger`. `MidiNote`, `sameNote` and `findTrigger` are in `src/shared/show.ts`.
- UI:
  - MIDI Triggers panel in the Show view: input picker (a lost port stays selected, marked "not found"), status, Trigger table (mode editable, Remove), and a new-Trigger row (channel, note, Learn, Scene, mode, Map).
  - A lost or failed input shows a warning above every view.

Acceptance:

- Trigger behaviour with synthetic MIDI messages: `src/engine/midi-triggers.test.ts` (13 tests through `createEngine` with a fake `MidiPorts`).
- Port loss and return in the UI: the `midiInput` event's `lost`/`connected` state, tested in "holds the current look when the port is lost…". It is shown in the panel and in the app-wide warning.

`npm test` (198), `typecheck`, `lint`, `format:check` and `build` pass. The UI and real MIDI were not run: the devcontainer has no display and no ALSA.

Open points for the user:

- The selected MIDI input is not saved. It must be chosen again after every start.
- Port loss is found by listing port names. It cannot see:
  - an rtpMIDI peer dropping (the local session port stays listed);
  - a USB device unplugged and replugged within one second (the old handle is kept).
- Two inputs with the same name (two identical controllers) cannot be told apart. The first one opens. The Windows build uses plain port names with no index, so names stay stable when devices are added.
- Flash release is a cut back to the previous Scene. If that Scene was mid-fade, its fade continues from where it would be now.
- A note-off lost while the port was gone leaves the Flash on until that pad is pressed and released again.
- Not asked for but added: `failed` state with retry, note names (C4) in the UI, typing channel and note by hand.
- `CONTEXT.md` does not define "MIDI input" or "MIDI learn". Not changed.

### 2026-10-07: closed open points (user)

- The selected MIDI Input is kept between runs on this machine, in `midi-input.json` in the app's user data folder (`--midi-input=` engine argument). At start the engine reopens it. If it is not plugged in yet, it shows as lost until it appears. An unreadable file starts with no input. Done.
- An rtpMIDI peer dropping is not detected. Accepted for the MVP.
- A USB unplug and replug within one second is not detected. Accepted: choosing the port again fixes it.
- Two inputs with the same name: the first one opens. Accepted.
- Flash release stays a cut back to the previous Scene.
- A note-off lost during port loss leaves the Flash on. Accepted: Blackout and Base Look (issue 12) cover it.
- The extras stay: `failed` state with retry, note names, typing channel and note by hand.
- `CONTEXT.md` defines **MIDI Input**. "MIDI learn" is a UI action and is not added.
