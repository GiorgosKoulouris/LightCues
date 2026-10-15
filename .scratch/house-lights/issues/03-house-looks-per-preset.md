# House looks per House Preset, and the Venue Check

Status: resolved
Blocked by: 01, 02

See spec, "Where things live", "House looks" and "UI".

## Work

- `src/shared/venue-patch.ts`: house looks keyed by House Preset id, same shape as the Startup look. Kept when the Show lacks the slot. Removing a Group drops it from every look.
- Venue Patch editor House tab: one look per House Preset of the loaded Show, by name. Stored looks for slots not in that Show are listed as "not in this Show" with delete. With no Show, only the Startup look and stored looks. Live preview as in 01.
- `src/shared/venue-check.ts`: list House Presets with no look in this Venue Patch ("not set up in this venue").
- CHANGELOG line.

## Acceptance

- Tests: look edits, orphan looks kept and deletable, Group removal, Venue Check entries.
- App test: set a look for a House Preset with a Show loaded; see an orphan look without it.
- `npm run check` passes.

## Comments

### 2026-10-15: implemented

Done on `dev`. `npm run check` passes.

Decisions:

- **Model:** `House.looks?: Record<string, HouseLook>`, keyed by House Preset id. Read with `houseLook(patch, id)`, set with `setHouseLook(patch, id, look)`. A look with no Group is removed, like the Startup look, so "has a look" means "sets something". Editing a look keeps its place in `looks`. Validation errors read `House look "<id>": …`; the Venue Patch only knows the id.
- **Removing a House Group** drops it from the Startup look and every house look. A look left with no Group goes.
- **`.lcvenue` stays version 3.** v3 is unreleased (added on `dev` after v0.1.1), so `looks` joins it. The file check covers its shape.
- **Edit:** `setHouseLook { preset, look? }`. Undoable; quick edits to one look merge into one undo step, apart from other looks.
- **Venue Check:** `unsetHousePresets(show, patch)` lists the Show's House Presets with no look, in Show order. `lookPresetsNotInShow(show, patch)` lists stored looks the Show lacks. There is no Venue Check view yet, so the House tab shows it as a "Not set up in this venue" badge on each House Preset. The badge shows even before any House Group exists.
- **House tab:** a "House looks" section under the Startup look. One card per House Preset of the Show, by name, with the look editor. Looks for slots not in the Show come after as "Other look N" with a "Not in this Show" badge, the editor and a remove button (toast; Undo brings it back). The Venue Patch stores only the id, so these have no name. With no Show, the stored looks show without the badge. Editing any look previews it live; leaving the tab ends the preview, as in 01.
- **README:** no change yet. House Presets still do nothing until 04, so the README step belongs there.
- **App test:** `VenuePatchView.test.tsx` covers setting a look for a House Preset with a Show loaded (live preview, badge), removing an orphan look, the badge with no Group, and stored looks with no Show. No e2e test, as in 01.

