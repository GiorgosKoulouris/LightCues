# Speed limit indicators

Status: ready-for-human
Blocked by: 01

See spec: Implementation Decisions, "Effect editor" and "Scene button badge".

## What to build

- Effect editor: for a movement Effect, "limited to <length> at current Tempo" from the fitting function at the live Tempo. Updates with the Tempo.
- Scene button (Perform and Fallback Panel): a badge while its Scene is active and limited, from the `playback` event, with a tooltip naming the length in use.
- CHANGELOG line.

## Acceptance

- The note shows and clears as the Tempo crosses the limit.
- The badge shows on both Perform and Fallback Panel Scene buttons and clears when no longer limited.
- `npm test` and lint pass. Check in the running app.

## Comments

Code done. Left: the check in the running app. Electron does not start in the devcontainer (no GTK), so it is for the Windows host.

- `usePlayback` passes `limited` through.
- **Scene buttons.** `SpeedLimitBadge` in `panel/controls.tsx` is shared by Perform and the Fallback Panel. The two Scene buttons themselves stay separate, as they were. The badge reads "Limited", tone warning, while the Scene is active and its Layer is in `limited`. Its `title` tooltip says "Speed limit: movement Effects run at <length>", the longest length on that Layer (issue 01).
- **Effect editor.** `EffectPicker` shows "Limited to <length> at current Tempo" from `fitSpeedLimit` at the live Tempo, without hysteresis. When the size shrinks at 16 beats, it also names the size: "Limited to 16 beats and 127.3° at current Tempo". It shows nothing while the Tempo is unknown. ShowView reads the Tempo with `useTempo` and passes `bpm` down through SceneEditor and RuleCard.
- `beatsText` in `shared/show.ts` ("1/2 beat", "2 beats"), now also used for strobe labels.
- Not done: the Base Look button gets no badge. It is not one of the Scene buttons. In Perform, the same Scene's button in its Layer shows the badge.
- CHANGELOG: a separate line for the indicators, as the spec asks. Merge it with the Speed limit line at the changelog review.

To check on Windows (`npm run dev`): Open example → Show → Circle → set Length to 1/4. At 120 BPM the note reads "Limited to 2 beats at current Tempo". Fire Circle: the Fallback Panel and Perform buttons show **Limited** with a "2 beats" tooltip. Tap about 60 BPM: the note says 1 beat, and the badge follows at the next boundary. Clear the Layer: the badge goes.
