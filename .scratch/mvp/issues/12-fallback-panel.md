# Manual fallback panel

Status: ready-for-agent
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
