# Effect slots, None and sub-beat lengths

Status: ready-for-human

See spec, "Effect slots", "Show file" and "UI".

## Work

- `src/shared/show.ts`: room for three Effect slots on a Rule (movement, intensity, colour). Each is absent, None or an Effect. The movement slot keeps reading v4 files' `effect`. Pick the field shape and note it. Lengths gain 1/4 and 1/2 beat for every kind.
- `src/engine/scene-resolution.ts`: a movement None stops lower Layers' movement Effect: the turn goes still, faded in over the Scene's fade-in like any turn. The intensity and colour slots are stored and validated, but do nothing until 03 and 04.
- `EffectPicker`: None, and the new lengths.
- `CONTEXT.md`: **Effect** names the three kinds. Note None.
- CHANGELOG line.

## Acceptance

- Tests: validation; v4 file with `effect` reads as the movement slot; v5 round-trip; movement None over a lower Layer's Effect, with and without fade-in; 1/4 and 1/2 beat cycles.
- App test: set movement Effect to None; pick a 1/4-beat length.
- `npm run check` passes.

## Comments

### 2026-10-16: implemented

Done on `dev`. `npm run check` passes. Left for a human: on a real Output with movers, check a 1/4-beat movement Effect at a fast Tempo (the motors may not keep up: a 10° sweep at 1/4 beat and 140 BPM is over 9 cycles a second), and a movement None stilling a sweep with a fade-in. Then set `resolved`.

Decisions:

- **Field shape:** one flat field per slot, `movementEffect?`, `intensityEffect?` and `colourEffect?`, each `EffectSlot<E> = E | 'None'` (`NO_EFFECT`). `Rule.effect` is renamed to `movementEffect` in v5 (unreleased, so no v5 file needs it). A v4 file's `effect` is read as `movementEffect`; a v5 file with `effect`, or a v4 file with the new fields, is rejected as an unknown field. The rename is noted in `show-file.ts`.
- **Intensity and colour slots:** typed as `'None'` only, validated ("must be None"), stored and round-tripped, and ignored by the engine. 03 and 04 widen them to `EffectSlot<IntensityEffect>` and `EffectSlot<ColourEffect>`, and add their pickers.
- **Engine:** a movement None gives the moving Fixture a still turn. It combines like any turn: last change wins across Layers (as for every setting, not strictly by Layer order), a later Rule's None stops an earlier Rule's Effect in the same Scene, and the turn fades to still over the Scene's fade-in.
- **Lengths:** `EFFECT_LENGTHS = [0.25, 0.5, 1, 2, 4, 8, 16]`, one list for every kind. `beatsLabel` (in `show.ts`) gives "1/4", "1/2", and the Strobe picker now uses it too.
- **Lenient on old files:** a v4 file holding `"effect": "None"` or a sub-beat length now loads. v4 never wrote either, so no version check was added.
- **UI:** `EffectPicker` gets a None option (no size, length or Spread shown) and lists the lengths as 1/4, 1/2, 1, …
- **Docs:** CONTEXT.md **Effect** names the three kinds, the slots, None and the lengths; **Rule** lists Effects. Two CHANGELOG lines, and the file-version line. `examples/demo.lcshow` is regenerated with `movementEffect`.
