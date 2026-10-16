# Effect slots, None and sub-beat lengths

Status: ready-for-agent

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
