# Intensity Effects

Status: ready-for-human
Blocked by: 02

See spec, "Effect slots" and "Intensity Effects".

## Work

- `src/shared/show.ts`: intensity Effect: shape (Pulse, Ramp up, Ramp down, Square, Chase), depth 0–1, length, Spread. Validation.
- Engine: a pure function next to `effectTurn`, giving the scale at a beat and Spread delay. Chase lights 1/N of the cycle, N being the Spread positions among targeted Fixtures; In sync acts as Square.
- `src/engine/scene-resolution.ts`: the scale applies over the intensity the Layers below give, like `combinedTurn`. Depth fades in with the Scene's fade-in. None stops a lower Layer's intensity Effect. Spread orders every targeted Fixture. Fixtures without a dimmer scale emitters.
- Freeze holds it (same beat).
- Rule editor: intensity Effect picker with None.
- Preview animates it.
- `CONTEXT.md`: **Freeze** holds every Effect.
- CHANGELOG line.

## Acceptance

- Tests: each shape over a cycle; depth 0, 0.5, 1; Chase across 4 positions, Left→Right and Mirrored; Chase In sync; scaling a lower Layer's intensity; fade-in; None; Freeze; Blackout and Grand Master after it; dimmer-less Fixture.
- App test: add a Pulse to a Rule.
- `npm run check` passes.

## Comments

### 2026-10-16: implemented

Done on `dev`. `npm run check` passes. Left for a human: on a real Output, check a Pulse and a 4-Fixture Chase at 1 beat and 1/4 beat, at a fast Tempo, on a Fixture with a dimmer and one without (dimmers and LED drivers may smooth or step a fast change). Check one under strobe too: a Square or Chase that dips to 0 drops the strobe rate while dark, and sets it again when lit. Then set `resolved`.

Decisions:

- **Type:** `IntensityEffect { shape, depth, length, spread }`, `INTENSITY_SHAPES`. `Rule.intensityEffect` is `EffectSlot<IntensityEffect>`. Depth is 0–1 inclusive. The file reader allows its fields from v5 only.
- **Engine:** `intensityScale(effect, beat, delay, positions)` and `spreadPositions(spread, targeted)` sit beside `effectTurn` and `spreadDelay`. `movement-effects.ts` is renamed `effects.ts`, as every kind now uses it. Scale = 1 − depth × (1 − level). Pulse is (1 + cos)/2, full on the beat, dark half a cycle on. Ramps run 0→1 and 1→0. Square is lit for the first half.
- **Chase:** N is the number of distinct Spread delays among the targeted Fixtures. So Mirrored with 4 Fixtures gives N = 2 (centre pair, then outer pair), and Alternate gives N = 2. With one position (In sync, or every Fixture at one place) it is Square.
- **Combining:** the scale is a setting like the movement turn. The last change wins across Layers, and it applies to the combined intensity (highest of all Layers), before the Grand Master and Blackout. So a lower Layer's Pulse also scales a higher Layer's intensity when that Layer leaves the slot unset. This follows the spec's "scales the Fixture's resolved intensity". `TurnFade` became `Fade<T>`, shared by turn and scale.
- **Fade-in:** the scale fades from the one before, or the one below, so depth grows from 0. A None fades the dip out.
- **Freeze:** nothing new. It already holds the beat. A playback test covers it.
- **Preview:** nothing new. The engine pushes lights at 40 Hz when they change.
- **UI:** an Intensity Effect picker beside the movement one, with Not set, None and the five shapes. Depth is entered as a percent. A new Effect is depth 100%, 1 beat, In sync. Each picker's settings sit in a group named "<kind> Effect settings".
- **Docs:** CONTEXT.md **Effect** describes intensity Effects and qualifies the Chase _Avoid_ entry. **Freeze** holds every Effect. One CHANGELOG line; the README Rule step names both Effect kinds.
- **Not done:** the movement-only names (`effectTurn`, `EFFECT_SHAPES`, `EffectPicker`) keep their names. Renaming them `movement*` is a separate tidy-up.
