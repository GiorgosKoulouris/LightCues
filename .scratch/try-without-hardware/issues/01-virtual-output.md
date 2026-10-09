# Virtual Output

Status: resolved

See spec, "Virtual Output".

## Fix

- `src/engine/outputs.ts`: `virtual` is always in the status list, named "Virtual Output". Mapped Universes send their frame into a per-Universe buffer instead of a port. State `sending` when at least one Universe maps to it, else `unused`. Expose `lastFrame(universe)` for the monitor and tests.
- `src/shared/venue-patch.ts`: the check that two Universes can't share an Output (around the `byOutput` map) skips `virtual`.
- Venue Patch UI (`RigSetup.tsx`, `useOutputs.ts`): `virtual` appears in the Output picker like any other, with a short hint: "No hardware. See the channel monitor."
- `CONTEXT.md`: under Output, add "Virtual Output: an Output with no hardware, for trying a Show and for tests." Keep the Avoid list.

## Acceptance

- Tests in `outputs.test.ts`: `virtual` is listed with no ports. Two Universes on `virtual` both send. `lastFrame` returns the latest frame. Unmapping returns it to `unused`.
- Tests in the venue patch tests: two Universes on `virtual` are valid, two on the same real Output still fail.
- A Venue Patch with `virtual` saves and reopens.
- `npm run check` passes.

## Comments

### 2026-10-09: resolved

- `outputs.ts`: `virtual` is always listed last, as "Virtual Output". Universes on it store a copy of each frame instead of writing to a port. `lastFrame(universe)` returns it, and the engine exposes it as `Engine.lastFrame` for the monitor and tests. Frames of Universes moved off `virtual` are dropped.
- `VIRTUAL_OUTPUT` in `shared/venue-patch.ts`. The shared-Output check skips it.
- Rig setup: the hint shows in the Status cell of a Universe mapped to `virtual`, since a select option can't carry one.
- CONTEXT.md: Output now reads "physical, network or virtual", plus the Virtual Output line.
- Tests: `outputs.test.ts` (listed with no ports, two Universes send, latest frame, unmapping), `venue-patch.test.ts`, `venue-file.test.ts` (saves and reopens), `VenuePatchView.test.tsx`. "Two on one real Output fail" was already covered. `npm run check` passes.
