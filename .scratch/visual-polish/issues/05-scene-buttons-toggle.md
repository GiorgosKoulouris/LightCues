# Scene buttons toggle

Status: resolved

See spec, "Scene buttons toggle", and **Scene button** in `CONTEXT.md`.

## Acceptance

- Pressing a Scene button whose Scene is active clears its Layer, the same as a Release. Otherwise it activates the Scene, as today.
- Applies to the Perform Scene buttons and to the Fallback Panel's Scene buttons and their keys (`runPanelAction`, `usePanelKeys`). One shared rule, so all three agree.
- MIDI Go Triggers and the Show view's Go are unchanged.
- Blackout, Freeze and Blind behave as before: clearing a Layer during Blackout clears it, and nothing new is lit.
- Tests: Perform click on an inactive Scene goes, a click on the active one clears its Layer; the same for a Fallback Panel button and its key; a MIDI Go on the active Scene still goes.

## Comments

### 2026-10-09: implemented (agent)

- One shared rule: `pressScene(active, scene)` in `show/scenes.ts`. It returns `clearLayer` for the Scene's Layer when the Scene is active, else `goScene`.
- Perform Scene buttons and `runPanelAction` send its command. Fallback Panel buttons and keys both go through `runPanelAction`.
- MIDI Triggers (`playback.fire`) and the Show view's Go are unchanged.
- `clearLayer` drops a held Flash and clears the Layer, exactly as a Release does. Blackout, Freeze and Blind do not affect it.

Tests:
- `scenes.test.ts`: `pressScene` returns Go for an inactive Scene and a clear for the active one.
- `PerformView.test.tsx`: a click on an inactive Scene sends Go; a click on the active one clears its Layer.
- `FallbackPanel.test.tsx` (new): the same for the Panel buttons, for their number keys, and during Blackout.
- `midi-triggers.test.ts`: a second Go on the active Scene leaves it active.

Typecheck, lint, format and the full suite (632 tests) pass.

Review (standards and spec): no violations, nothing missing. Applied: a clearer test name and two comment fixes.

Left as is:
- The Fallback Panel looks up its Scenes in two places: the strip and `runPanelAction`.
- The toggle reads the renderer's playback state. Two presses before the engine replies can send two Gos or two clears. The result is harmless.
