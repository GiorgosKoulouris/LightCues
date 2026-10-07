# Scene editor

Status: resolved
Blocked by: 07, 08

UI to create Scenes: name, tags, Layer, fade time, and Rules with Zone/Role pickers, intensity and colour. Selecting Zones on the top-down view sets the Rule target.

## Acceptance

- Editing an active Scene updates the output live in Monitor, and only the preview in Blind.

## Comments

### 2026-10-07: from issue 07 (agent)

Edit through the pure functions in `src/shared/show.ts` (`putScene`, `removeScene`, `putLayer`, `removeLayer`, `setBaseLook`). Save/load is `src/engine/show-file.ts`. No engine session or protocol messages for the Show exist yet. Add them here or in 08. Removing a Layer removes its Scenes, so confirm in the UI.

### 2026-10-07: from issue 08 (agent)

The engine holds no Show or active Scenes yet. Whichever of 09 and 10 lands first adds the engine-side Show session and calls `resolveFrames` (`src/engine/scene-resolution.ts`) in the Outputs `frame` callback. Editing an active Scene needs no extra step: `resolveFrames` reads the current Show each tick.

### 2026-10-07: decisions (user)

- Monitor/Blind: 09 adds the mode in the engine and a toggle. Blind freezes Outputs at their current frame. Issue 11 adds the preview rendering.
- Activation: engine commands to activate a Scene and clear a Layer. The editor has Go per Scene and Clear per Layer. Issues 10 and 12 reuse the commands.
- Tests at one seam: the engine (Show session, activation, frames sent per mode). No renderer tests.
- Files: New/Open/Save/Save As for `.lcshow` with native dialogs. The close guard covers unsaved Show and Venue changes.

### 2026-10-07: implemented on `dev` (agent, devcontainer)

Done:

- Engine:
  - `src/engine/show-session.ts`: the current Show, like the Venue session. Commands `getShow`, `newShow`, `openShow`, `saveShow`, `editShow` (`putScene`, `removeScene`, `putLayer`, `removeLayer`, `setBaseLook`). Events `show` and `showDone`.
  - `src/engine/playback.ts`: active Scenes and the mode. Commands `getPlayback`, `goScene`, `clearLayer`, `setMode` (`monitor` | `blind`). Event `playback` with `active` (Scene id per Layer id) and `mode`.
  - An edit stops an active Scene that is removed or no longer in its Layer. A new or opened Show clears all Layers.
  - Outputs now call `frames()` once per send tick (was `frame(universe)`). Monitor resolves the Show with `resolveFrames`. Blind returns the frames sent last. A Universe with no frame gets blackout.
- Main and preload: Open/Save dialogs for `.lcshow`. The close guard tracks the Show and the Venue Patch, names both in the prompt, and saves them in turn (Show first).
- UI (`src/renderer/src/show/`), new Show tab:
  - File bar, Monitor/Blind switch.
  - Layers: add, rename, remove (confirm lists its Scenes), Clear, active Scene.
  - Scenes: list with tag filter, Go, New Scene, Base Look selector, Remove (confirm).
  - Scene editor: name, tags, Layer, fade-in, Rules (add, remove, reorder). Every change is sent at once, so an active Scene updates live.
  - Rule: Zone picker (Floor and Overhead top-down plans with the Venue Patch's Fixtures), Role checkboxes, intensity, colour (not set, swatch, hue and saturation).

Acceptance:

- Live in Monitor, preview-only in Blind: `outputs.test.ts` "engine Scene playback". It covers the fade-in, a live edit in Monitor, Outputs held in Blind while Scenes and edits change, return to Monitor, stop on removal or Layer change, and clear on a new Show. The preview half is issue 11.
- Show session: `engine.test.ts` "engine Show".

`npm test`, `typecheck`, `lint`, `format:check` and `build` pass. The UI was not run: the devcontainer has no display.

Open points for the user:

- Moving an active Scene to another Layer stops it. It does not move to the new Layer and replace that Layer's Scene.
- A Universe mapped while in Blind sends blackout until Monitor, because it has no held frame.
- The Show and Venue sessions, hooks and views repeat the same open/save/edit shape. A shared document session would remove this. Not done.
- Not asked for but added: Base Look selector, tag filter, Rule reordering.

### 2026-10-07: closed open points (user)

- Moving an active Scene to another Layer stops it. It does not replace the Scene in the new Layer.
- A Universe mapped while in Blind sends blackout until Monitor. Blind sends nothing new.
- The repeated Show/Venue session, hook and view code stays as is. No shared document session for now.
- The extras stay: Base Look selector, tag filter, Rule reordering.
