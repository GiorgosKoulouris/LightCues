# Intensity Effects

Status: ready-for-agent
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
