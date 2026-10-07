# Fixture Profile editor

Status: resolved
Blocked by: 02

UI to create and edit Fixture Profiles for fixtures missing from OFL: modes, channel list, capability per channel, default Role.

## Acceptance

- A new profile can be created from scratch, saved to the library and used in a Venue Patch.

## Comments

### 2026-10-07: open decision from issue 02 (agent)

Before starting this issue, ask the user to decide: may re-importing an OFL fixture overwrite a Profile with the same id that was edited by hand? `ProfileLibrary.importOfl` currently replaces by id. Do not implement saving edited Profiles until this is decided.

### 2026-10-07: decision on re-import (user)

Ask, then overwrite. The library records which Profiles were made or edited by hand. Re-importing an OFL fixture over one of them returns a conflict and saves nothing; the UI asks, and on confirm the OFL version replaces it and the hand-edited mark is cleared. Unedited OFL Profiles are still replaced by id.

### 2026-10-07: implemented on `dev` (agent, devcontainer)

Done:

- `ProfileLibrary` (`src/engine/profile-library.ts`): `put(profile, { replaces })` saves a hand-made or edited Profile and marks it hand-edited. A new Profile may not take an existing id; an edit may change the id. `remove`, `isHandEdited`, and `importOfl(..., { overwrite })` returning `status: 'imported' | 'conflict'`. File format is now version 2 (adds `handEdited` ids); version 1 files still load.
- Validation on save (`src/engine/validate-profile.ts`): manufacturer, model, at least one mode, unique mode and channel names, default values and ranges within 0–255, no overlapping ranges, fine channels linked to a control channel in the same mode, wheel colours as `#rrggbb`. Errors are returned as readable lines.
- Edit helpers (`src/shared/profile-edit.ts`): `profileId` (now also used by OFL import) and `renameChannel`, which keeps fine-channel links in step with a renamed control channel.
- Persistence: the engine keeps the library in `<userData>/profile-library.json`, written through a temp file. An unreadable file is renamed to `.unreadable-<time>` and the library starts empty.
- Protocol: `listProfiles`, `importOfl`, `saveProfile`, `deleteProfile` → `profiles`, `oflImported`, `profileSaved`.
- UI (`src/renderer/src/profiles/`): library list with source (OFL / edited by hand), New, Edit, Delete, OFL import (file + manufacturer, unsupported features listed, conflict confirm). Editor: manufacturer, model, derived id, default Role, modes (add, duplicate, rename, remove), channels (kind, name, default, reorder, remove), fine channel link and byte, ranges with capability and its parameters.
- Tests at the agreed seams: ProfileLibrary and edit helpers. Engine commands and UI are not unit-tested (by agreement); a scratch run checked save, failed import, conflict, reload from disk and the unreadable-file path. `npm test`, `typecheck`, `lint`, `format:check` and `build` pass.

Deferred / notes:

- Acceptance "used in a Venue Patch" can only be checked once issue 04 exists. A hand-made Profile has the same shape as an imported one and passes the same validation. Check it in issue 04.
- Removing a control channel or changing its kind leaves its fine channels pointing at it. Validation rejects this on save; the editor does not fix it up.
- Any save marks a Profile hand-edited, even with no changes, so a later re-import of it asks first.
- Changing manufacturer or model changes the id. A renamed OFL Profile no longer conflicts with its re-import; it imports as a second Profile.
- OFL Profiles whose 16-bit ranges were reduced to sharing a boundary value (issue 02) fail the overlap check on save and must be fixed in the editor.
- UI requests have no timeout; if the engine restarts mid-request, the editor waits.
- `unsupported` capabilities are kept and shown but cannot be picked for new ranges.

### 2026-10-07: acceptance checked in issue 04 (agent)

"Used in a Venue Patch" is covered: `src/engine/venue-file.test.ts` patches a Profile saved with `ProfileLibrary.put`, saves the patch and opens it without the library.

