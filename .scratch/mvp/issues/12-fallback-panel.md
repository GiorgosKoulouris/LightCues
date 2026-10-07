# Manual fallback panel

Status: resolved
Blocked by: 08, 10

Always-visible panel: Blackout, Base Look, Grand Master fader, a configurable set of Scene buttons, and a keyboard shortcut for each. Shows MIDI connection status and warnings.

## Acceptance

- Every panel action works with no MIDI input connected.
- Shortcuts work from any view, except while typing in a text field.

## Comments

### 2026-10-07: from issue 07 (agent)

The Base Look is `Show.baseLook` (a Scene id, optional), set with `setBaseLook` in `src/shared/show.ts`. The panel's Scene buttons are not in the Show yet; add them here (file version bump if needed).

### 2026-10-07: from issue 08 (agent)

The Grand Master is the last argument of `resolveFrames` (0–1). It scales intensity only. Base Look: `activate(active, show, show.baseLook, now)`. Blackout is not in the resolver; for example, send zero frames, or pass `grandMaster` 0. Note that colour channels and shutters keep their values under GM 0.

### 2026-10-07: from issue 09 (agent)

Scene buttons can send `goScene` and `clearLayer` (`src/shared/protocol.ts`). The Base Look is set in the Show view. The Grand Master is not passed to `resolveFrames` yet: add it in `src/engine/playback.ts` `frames()`.

### 2026-10-07: from issue 10 (agent)

MIDI status comes from the `midiInput` event (`MidiInputStatus` in `src/shared/protocol.ts`; send `listMidiInputs` for the current one). `useMidiInput()` and `midiWarning()` are in `src/renderer/src/show/useMidiInput.ts`. `App.tsx` shows the warning above every view for now. Move it into this panel.

### 2026-10-07: from issue 11 (agent)

The preview resolves on its own path: `playback.lights()` calls `resolveLights` (`src/engine/scene-resolution.ts`), which takes the Grand Master like `resolveFrames`. Pass it there too, so the preview shows the Grand Master. Blackout should show in the preview in both modes.

### 2026-10-07: implemented on `dev` (agent, devcontainer)

Done:

- Show: `Show.panelScenes` (Scene ids, in order, at most 9, `MAX_PANEL_SCENES`), set with the `setPanelScenes` edit (`setPanelScenes` in `src/shared/show.ts`). Removing a Scene takes its button off. `.lcshow` is now version 3; versions 1 and 2 load without Scene buttons.
- Engine (`src/engine/playback.ts`):
  - `setGrandMaster` (`level` 0–1, clamped; NaN counts as 0) and `setBlackout` (`on`). Both are passed to `resolveFrames` and `resolveLights`, so the preview shows them. Blackout resolves as Grand Master 0: intensity only, colours kept, the Scenes stay active.
  - `goBaseLook`: clears every other Layer and held Flashes, and crossfades the Base Look's own Layer into it. Does nothing without a Base Look.
  - The `playback` event now carries `grandMaster` and `blackout`.
- UI: `FallbackPanel` (`src/renderer/src/panel/`) sits above every view and stays in view when scrolling. It has Blackout (toggle), Base Look, the Grand Master slider, the Show's Scene buttons, and the MIDI Input status with its warning (moved from `App.tsx`). Scene buttons are picked with a "Fallback Panel" checkbox per Scene in the Show view.
- Shortcuts (`shortcuts.ts`, pure): B Blackout, 0 Base Look, 1–9 Scene buttons, - / + (or =) Grand Master by 10%. Keys with Ctrl, Alt or Meta are ignored. A held key repeats only the Grand Master. Each button shows its key.
- `CONTEXT.md` defines **Fallback Panel** and **Blackout**. **Base Look** now says that going to it clears every other Layer.

Acceptance:

- Works with no MIDI input: the "engine Fallback Panel" tests in `src/engine/outputs.test.ts` run on an engine with no MIDI ports. The panel's actions are plain engine commands and do not use MIDI.
- Shortcuts from any view except while typing: one `window` keydown listener in the always-mounted panel. `isTextEntry` skips text inputs, text areas and editable content. Sliders, check boxes, buttons and lists still take shortcuts. Tested in `shortcuts.test.ts`.

`npm test` (225), `typecheck`, `lint`, `format:check` and `build` pass. Code review (standards + spec) done; small fixes applied. The UI was not run: the devcontainer has no display.

Open points for the user:

- **Blackout in Blind does not reach the rig.** Blind holds the Outputs, so Blackout and the Grand Master show only in the preview until you go back to Monitor. Consistent with Blind, but a safety Blackout that leaves the stage lit may not be what you want. Option: Blackout always sends to the Outputs.
- **Base Look clears every other Layer.** This was not in the spec; it was chosen so the Base Look is a known safe look. The alternative is to replace only its own Layer and keep accents on the others.
- **9 Scene buttons at most**, one per digit key. Shortcuts are fixed, not configurable.
- Blackout is a toggle, and turning it off snaps back at once, with no fade.
- The Grand Master is not saved; it starts at 100% on every run.

### 2026-10-07: closed open points (user)

- Blackout in Blind: **Blackout now always reaches the rig**, in Blind too. Turning it off in Blind holds the Outputs at the frames from before again. The Grand Master stays preview-only in Blind. `CONTEXT.md` (Blind, Blackout) and the Blind hint in the Show view say so. Done.
- Base Look clears every other Layer. Accepted.
- At most 9 Scene buttons, fixed shortcuts. Accepted for the MVP.
- Blackout off snaps back, no fade. Accepted.
- Grand Master not saved, starts at 100%. Accepted.
