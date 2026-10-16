# Colour Effects

Status: ready-for-agent
Blocked by: 02

See spec, "Effect slots" and "Colour Effects".

## Work

- `src/shared/show.ts`: colour Effect: 2–4 colours with Step or Fade, or Rainbow; length, Spread. A Rule with both a colour and a colour Effect is invalid. Validation.
- Engine: a pure function giving the colour at a beat and Spread delay.
- `src/engine/scene-resolution.ts`: the Effect's colour is the Look's colour. It crossfades from the previous colour over the fade-in. None stops a lower Layer's colour Effect. Spread orders every targeted Fixture. Wheel Fixtures snap to the nearest slot.
- Freeze holds it (same beat).
- Rule editor: Colour / Colour Effect switch; colour list editor (reuse the Rule colour control), Step/Fade, Rainbow.
- Preview animates it.
- CHANGELOG line.

## Acceptance

- Tests: Step and Fade with 2 and 4 colours; Rainbow; Alternate with 2 colours gives odd/even; fade-in from a plain colour; None; Freeze; colour plus colour Effect rejected; wheel Fixture snaps.
- App test: set a two-colour Step Effect on a Rule.
- `npm run check` passes.

## Comments
