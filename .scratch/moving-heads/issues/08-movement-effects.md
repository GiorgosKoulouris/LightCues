# Movement Effects

Status: ready-for-agent
Blocked by: 02, 04, 07

See spec, "Movement Effects".

## Acceptance

- `Rule` gains an optional movement Effect: shape (Circle, Pan sweep, Tilt sweep, Ballyhoo), size (degrees), length (beats: 1, 2, 4, 8, 16) and Spread (In sync, Left→Right, Mirrored, Alternate).
- Combined "last changed wins", separate from `direction`. It runs around the mover's resolved base aim (from any Scene, else the Default Direction).
- The offset is applied in degrees around the base aim, then clamped to the Fixture's range.
- Phase follows the engine's beat phase, so Effects stay on the beat when the Tempo changes.
- Spread orders the targeted Fixtures by stage x (Mirrored by |x|; Alternate by order in x).
- Ballyhoo is smooth and deterministic per Fixture id.
- On a crossfade the Effect's size fades in with the Scene.
- The Scene editor's Rule row gets the movement Effect controls, with size quick picks Small 5°, Medium 12°, Large 25°.
- `.lcshow` version bump if not already bumped in this batch.
- Tests: each shape at known beat phases, each Spread, Tempo change keeps phase, combining with a Direction from another Layer.
