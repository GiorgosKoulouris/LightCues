# Virtual Output

Status: ready-for-agent

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
