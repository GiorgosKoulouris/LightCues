# Venue Patch model and .lcvenue file

Status: resolved
Blocked by: 02

Venue Patch: stage bounds, Universes, Universe → Output mapping, Fixtures (Profile + mode, Universe, address, X/Y, height, Role override, Zone). Zone is suggested from position (thirds of stage bounds plus a Front row; Floor/Overhead by height) and can be overridden. Save/load versioned JSON with embedded Profile copies.

## Acceptance

- Overlapping and out-of-range addresses are rejected.
- Zone suggestion is tested for each grid cell and the Front row.
- A saved file opens on a machine without those Profiles in its library.

## Comments

### 2026-10-07: carried over from issue 03 (agent)

Issue 03's acceptance "a new profile can be created from scratch, saved to the library and used in a Venue Patch" needs this issue. Include a test that patches a hand-made Profile (`ProfileLibrary.put`), not only an OFL one.

### 2026-10-07: decisions (user)

- Stage coordinates in metres. x from the centre line, + toward Stage Left (audience's right). y from the downstage edge, + upstage; y < 0 is the Front row. height above the stage floor.
- Overhead from height ≥ 2 m.
- If the patch already embeds a Profile id, adding another Fixture of it keeps the patch's copy. Refreshing from the library is a later, explicit action.
- Tests at two seams: the pure Venue Patch functions and `.lcvenue` save/load. Engine/protocol wiring goes to issue 05.

### 2026-10-07: implemented on `dev` (agent, devcontainer)

Done:

- `src/shared/venue-patch.ts` (pure, immutable): `emptyPatch` (one unmapped Universe 1), `setStage`, `putUniverse` / `removeUniverse` (also removes that Universe's Fixtures), `putFixture` / `removeFixture`, `suggestZone`, `fixtureZone`, `fixtureRole`, `patchProfile`, `fixtureMode`, `validatePatch`. Changing calls return `{ patch }` or `{ errors }` with readable lines.
- Zone suggestion: thirds of width and depth; y < 0 → Front; outside the stage → nearest cell; on a boundary → upstage / toward Stage Left (with a float tolerance, tested on a decimal-sized stage).
- Validation: stage size > 0; Universe numbers whole, ≥ 1, unique; addresses whole 1–512; footprint must end by 512; no overlap within a Universe; Universe, Profile and mode must exist; mode has channels; position is numeric; Role/Zone overrides are valid values; Fixture ids and embedded Profile ids unique.
- Embedded Profiles: `putFixture(patch, fixture, profile)` embeds a copy when the patch lacks it. Copies no Fixture uses are dropped.
- `src/engine/venue-file.ts`: `saveVenueFile` / `loadVenueFile`, version 1. Load rejects unknown versions, missing parts and invalid patches.
- Tests: every on-stage cell and the Front row per column; Overhead threshold; overlap and out-of-range rejection; a file with a hand-made (`ProfileLibrary.put`) and an OFL Profile opens with no library. `npm test`, `typecheck`, `lint`, `format:check` pass.

Notes for later issues:

- Not asked for by the spec: two Universes may not map to the same Output (an Output is one port). Drop the rule if Outputs turn out to carry several Universes.
- Output ids are opaque strings; issue 06 defines them.
- Fixture ids are supplied by the caller (e.g. `crypto.randomUUID()` in the editor).
- Embedded Profiles are not re-run through `validateProfile` on load (some OFL Profiles fail its overlap check, see issue 03).
- No refresh of an embedded Profile from the library yet.

