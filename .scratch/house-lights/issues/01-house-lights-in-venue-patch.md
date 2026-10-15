# House Lights, House Groups and the Startup look

Status: resolved

See spec, "Terms", "Separation from the show engine", "House looks" and "UI".

## Work

- `src/shared/venue-patch.ts`: House Groups (id, name), House Lights (id, name, group, profileId, mode, universe, address), and an optional Startup look (Group id → intensity, colour). Edits to add, rename, remove Groups and Lights; removing a Group with Lights is rejected or removes them (decide and note it). The address-overlap check covers stage Fixtures and House Lights together. Profiles used by House Lights are embedded like any other.
- `src/engine/venue-file.ts`: new fields are optional, so older `.lcvenue` files still read. Bump the version only if the existing scheme needs it.
- Engine output: House Lights get the current house state, which starts at the Startup look (full white with none). Blind, Blackout, Grand Master and Freeze do not apply to them. Scene resolution never sees them. Intensity and colour follow the stage Fixture rules.
- Channel monitor shows House Light channels like any other.
- Venue Patch editor: a House tab with Groups, their House Lights (reuse the Fixture patch fields, without position, Zone, Role, Mounting), and the Startup look editor. Editing the look previews live; leaving the tab restores the previous house state.
- CHANGELOG line.

## Acceptance

- Tests: patch edits and validation (overlap with stage Fixtures, unknown Group, unknown Profile/mode), file round-trip and reading an old file, output in Monitor, Blind, Blackout and at Grand Master 0, dimmer-only and RGB-only Profiles.
- App test: add a Group and a Light, set the Startup look.
- `npm run check` passes.

## Comments

### 2026-10-15: implemented

Done on `dev`. `npm run check` passes.

Decisions:

- **Removing a House Group removes its House Lights** and its Startup look setting, like removing a Universe removes its Fixtures. One undo step; the toast names the Lights.
- **`.lcvenue` version 3.** v2 bumped for the optional Mounting, so the optional `house` bumps too. v1 and v2 files still open, with no House. An older app refuses a v3 file instead of dropping its House Lights.
- **Model:** `VenuePatch.house?: { groups, lights, startupLook? }`, read through `patchHouse`. `AddressedFixture` is the shared base of `PatchedFixture` and `HouseLight`. Fixture ids are unique across both. `addressProblem`, `nextAddress`, the channel monitor and the Rig setup count cover House Lights.
- **Colour** moved to `src/shared/colour.ts`, so the Venue Patch validates it without importing the Show. `show.ts` re-exports it.
- **Engine:** `src/engine/house.ts` writes the House Lights over the frames playback gives, after Blind, Blackout, the Grand Master and the Focus Check. Encoding reuses `levelChannels` from scene resolution, so the stage Fixture rules apply. The preview never sees House Lights.
- **Startup look:** applied on launch reopen, Open and New. Editing it does not change the house state. In the House tab, the first edit starts a live preview (`previewHouseLook`); leaving the tab or the view ends it. The preload replays the last preview to a restarted engine.
- **Engine restart:** the House goes to the Startup look. The house state is not in the snapshot yet. Issue 04 should add it, so a restart keeps a fired House Preset.
- **House tab:** each House Light row has a House Group select, to move it between Groups.
- **App test:** the view test in `VenuePatchView.test.tsx` covers adding a Group and a Light and setting the Startup look. No e2e test, as e2e is not in CI.

