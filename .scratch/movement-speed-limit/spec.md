# Movement speed limit

Status: ready-for-agent

## Problem Statement

A movement Effect runs at the Tempo. At a high Tempo, a short length and a medium size, it asks a moving Fixture to turn far faster than any head can. A 45° Pan sweep at 1/4 beat and 140 BPM peaks at about 2,600°/s. Fast beams do about 400–600°/s.

The head cannot follow. It loses steps, strains its motors and belts, and wobbles where it should sweep. The operator has no warning: the Scene looks fine in the preview and is wrong on the rig.

## Solution

A fixed **Speed limit** of 300°/s, checked on pan and tilt separately, applies to every movement Effect.

When an Effect would go faster, it runs at a longer length instead: the shortest of 1/4, 1/2, 1, 2, 4, 8 and 16 beats that stays under the limit. The size and the beat lock stay as they are. Only if 16 beats is still too fast does the size shrink to fit.

The length switches only on a beat where no Fixture jumps. It steps back to a shorter length only when it is clearly under the limit, so it does not keep flipping when the Tempo hovers near the line.

The operator sees it. The Effect editor says "limited to 1/2 at current Tempo". A Scene button in Perform and on the Fallback Panel shows a badge while one of its Effects is limited.

The Speed limit is always on.

## User Stories

1. As an operator, I want fast movement Effects slowed to what a head can do, so that I don't damage Fixtures at high Tempos.
2. As an operator, I want a limited Effect to stay locked to the beat, so that the movement still feels in time with the music.
3. As an operator, I want a limited Effect to keep its size, so that the look keeps its scale and only gets slower.
4. As an operator, I want the slowest the Speed limit picks to be one of the normal Effect lengths, so that a limited Effect looks like one I could have programmed.
5. As an operator, I want a Ballyhoo limited by its real peak speed, not a sine's, so that its faster harmonics are covered too.
6. As an operator, I want a Circle limited per axis, so that neither the pan nor the tilt motor is overdriven.
7. As an operator, I want a Pan sweep limited only by pan and a Tilt sweep only by tilt, so that each is limited on the axis it moves.
8. As an operator, I want an Effect that is still too fast at 16 beats to shrink in size, so that the limit holds in every case.
9. As an operator, I want an Effect under the limit to run exactly as programmed, so that the Speed limit changes nothing at normal Tempos.
10. As an operator, I want the length to change without a visible jump when the Tempo rises past the limit, so that the rig never snaps mid-song.
11. As an operator, I want the length to step back down when the Tempo falls, so that the Effect returns to its programmed speed.
12. As an operator, I want the length not to flip back and forth when the Tempo hovers near the limit, so that the movement stays steady with a drifting MIDI Clock.
13. As an operator, I want every Fixture in a Rule to use the same length, so that a Spread (Left→Right, Mirrored, Alternate) keeps its shape.
14. As an operator, I want an Effect checked at its full size while it fades in, so that its length doesn't change halfway through the fade.
15. As an operator, I want a Scene started while the Tempo is already high to start at the limited length, so that it is safe from its first frame.
16. As an operator, I want the Speed limit to work with Tap Tempo and MIDI Clock alike, so that it doesn't matter where the Tempo comes from.
17. As an operator, I want a limited Effect to keep running at its length when the MIDI Clock is lost, so that the held Tempo keeps it safe.
18. As an operator, I want Freeze to hold a limited Effect where it is like any other, so that Freeze behaves the same.
19. As an operator, I want the preview to show the limited movement, so that what I see is what the rig does, in Monitor and in Blind.
20. As an operator, I want the Effect editor to tell me when an Effect is limited at the current Tempo, and to what length, so that I understand why it looks slower than I set.
21. As an operator, I want that note to update when the Tempo changes, so that I can see where the limit starts while programming.
22. As an operator, I want a badge on an active Scene's button in Perform while one of its Effects is limited, so that I know during the show.
23. As an operator, I want the same badge on the Fallback Panel's Scene buttons, so that the manual controls tell me the same thing.
24. As an operator, I want the badge's tooltip to name the length used, so that I can tell how much it was slowed.
25. As an operator, I want the badge to disappear when the Effect is no longer limited, so that it means "limited now".
26. As an operator, I want a Show saved with fast Effects to keep its programmed lengths, so that the same Show runs as written at a lower Tempo.
27. As a show programmer, I want Shows that never reach the limit to look exactly as before, so that the update changes nothing I have already tuned.
28. As a developer, I want the length-fitting math in one pure shared function, so that the engine and the editor agree and it is cheap to test.

## Implementation Decisions

- **Speed limit**: an app-wide constant of 300°/s, next to the other Effect limits in the shared Show model. Not per Profile, Fixture or Show; Profiles have no max speed data. No setting to turn it off.
- **Peak speed per axis** for a movement Effect is 2π · size · cycles-per-second, weighted by the shape:
  - Circle: pan and tilt both 1 × size.
  - Pan sweep: pan only. Tilt sweep: tilt only.
  - Ballyhoo: pan 0.6·1 + 0.4·2 = 1.4 × size, tilt 0.6·1 + 0.4·3 = 1.8 × size. This is the worst case over the Fixture's own offsets.
  - The Effect is over the limit when the faster axis is.
- **Fitting function** (new, pure, in shared code so both the engine and the renderer can use it). Given a movement Effect and a BPM, it returns the length to run at, the size to run at, and whether either changed. It picks the shortest allowed length ≥ the programmed one that fits. If none fits, it uses 16 beats and the largest size that fits. It always uses the Effect's full size, ignoring the fade-in.
- **Held length in playback.** Playback keeps, per active Effect, the length it is running at. On every tick:
  - The target is the fitting function's length at the current BPM.
  - It steps up to a longer target, or down to a shorter one, only on a beat that is a whole multiple of the longer of the two lengths. Both lengths are at the same phase there, Spread delays included, so no Fixture jumps.
  - It steps down only when the Effect would be at ≤ 90% of the limit at the shorter length (hysteresis).
  - A Scene that starts takes the fitting function's length straight away.
  - Under Freeze the beat does not move, so no switch happens. When Freeze ends, the next boundary applies.
- **Scene resolution stays pure.** It takes the length and size to run each movement Effect at, from playback, instead of always reading the Effect as programmed. Intensity and colour Effects are not touched.
- **The Show is never changed.** The limited length exists only at run time and is never saved.
- **Playback event.** The `playback` event gets, per Layer, the limited length of its active Scene's movement Effects, when there is one, e.g. the longest length in use. Playback emits it when that changes, not every frame.
- **Effect editor.** For a movement Effect, it calls the fitting function at the current Tempo and shows "limited to <length> at current Tempo" when the length or size changed. No hysteresis there: it is a guide.
- **Scene button badge.** Perform and the Fallback Panel share the Scene button. It shows a small badge while its Scene is active and limited, with a tooltip naming the length in use.
- **Domain docs.** CONTEXT.md gets a **Speed limit** entry, and the Effect entry mentions it. ADR 0015 records the choice: step up the length rather than clamp each frame (a per-frame clamp loses the shape and the beat), at a fixed app-wide 300°/s (no Profile data to do better).
- **Changelog.** A line under Unreleased for the Speed limit, and one for the indicator, each in the commit that adds it.

## Testing Decisions

- Test what the operator gets, not how it's computed. That means pan/tilt in the sent frames over time, the `playback` event, and the fitting function's return value. Never the held-length bookkeeping.
- **Fitting function** (pure unit tests), prior art: the effects tests. Cover:
  - under the limit → unchanged
  - each shape's axis weighting, Ballyhoo at 1.8× on tilt
  - stepping 1/4 → 1/2 → … at rising BPM
  - an Effect programmed at 2 beats never going shorter
  - 16 beats still too fast → size shrinks to exactly the limit
  - the limit boundary itself (exactly 300°/s fits)
- **Playback** (fake `now`, `beat`, `bpm`), prior art: the playback tests. Cover:
  - a fast Effect's pan never moves more per frame than the limit allows
  - the BPM rising past the limit switches length only at a boundary of the longer length, with no jump in pan/tilt across the switch, Spread included
  - the BPM hovering within the hysteresis band does not flip the length
  - the BPM falling clearly under switches back down
  - a Scene started at a high BPM is limited from its first frame
  - Freeze holds and resumes as before
  - the `playback` event reports a limited Layer and stops when it no longer is
  - an Effect under the limit gives the same frames as before
- **Renderer.** Test the editor note and the badge where component tests already exist for the Effect picker and Perform. Otherwise, check them in the running app.

## Out of Scope

- Limiting Direction changes, Scene crossfades between Directions, the Focus Check, or the jump when Freeze ends. The Fixture's own speed handles these, as on any console.
- A max speed per Profile, Fixture or Show, and importing one from GDTF or OFL.
- Driving a Fixture's Pan/Tilt speed channel.
- Turning the Speed limit off.
- Warning about fast Effects in the Venue Check.

## Further Notes

- At 120 BPM, 300°/s allows about 6° at 1/4 beat, 24° at 1 beat and 95° at 4 beats. Most fast, small Effects will be limited. That is intended.
- 300°/s is conservative for beams. If it feels too slow on real rigs, changing the constant is a one-line change. A per-Fixture value would need a new spec.
- Issues: 01 (engine Speed limit), 02 (indicators, blocked by 01).
