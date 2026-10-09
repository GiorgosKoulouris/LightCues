# Scene buttons toggle

Status: ready-for-agent

See spec, "Scene buttons toggle", and **Scene button** in `CONTEXT.md`.

## Acceptance

- Pressing a Scene button whose Scene is active clears its Layer, the same as a Release. Otherwise it activates the Scene, as today.
- Applies to the Perform Scene buttons and to the Fallback Panel's Scene buttons and their keys (`runPanelAction`, `usePanelKeys`). One shared rule, so all three agree.
- MIDI Go Triggers and the Show view's Go are unchanged.
- Blackout, Freeze and Blind behave as before: clearing a Layer during Blackout clears it, and nothing new is lit.
- Tests: Perform click on an inactive Scene goes, a click on the active one clears its Layer; the same for a Fallback Panel button and its key; a MIDI Go on the active Scene still goes.
