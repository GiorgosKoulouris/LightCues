# Venue Patch top-down editor

Status: resolved
Blocked by: 04

Top-down stage view showing stage bounds and the Zone grid. Add, place, drag and configure Fixtures (Universe, address, height, Role, Zone override). Add/remove Universes and assign Outputs.

## Acceptance

- Dragging a Fixture updates its suggested Zone unless overridden.
- Removing a Universe that has Fixtures asks for confirmation.

## Comments

### 2026-10-07: from issue 04 (agent)

The model is in `src/shared/venue-patch.ts` (pure functions, usable in the UI for live Zone suggestion) and `src/engine/venue-file.ts`. Not done yet, and needed here:

- Engine state and protocol commands for the current Venue Patch: new, open/save `.lcvenue`, and the edit operations. Decide where the patch lives (the engine, like the Profile Library, is the default).
- `removeUniverse` drops the Universe's Fixtures without asking; the confirmation is this issue's job.
- Adding a Fixture passes the library Profile to `putFixture`; the patch keeps its own copy if it already has that id.


### 2026-10-07: decisions (user)

- The current Venue Patch lives in the engine.
- `.lcvenue` files: main shows native Open/Save dialogs and returns a path. The engine reads and writes the file and remembers the path; Save writes in place, Save As picks a new path.
- Tests at two seams: the engine's Venue Patch commands (through `createEngine`, with fake file access) and pure helpers (moving a Fixture, Fixtures in a Universe). No UI tests.
- Outputs are assigned as a free-text Output id per Universe; blank is unmapped. Issue 06 replaces it with discovered Outputs.

### 2026-10-07: implemented on `dev` (agent, devcontainer)

Done:

- Engine (`src/engine/venue-session.ts`, wired in `engine.ts`): holds the current Venue Patch, the file it came from and an `unsaved` flag. A new patch has a 10 × 8 m stage and one unmapped Universe 1.
- Protocol: `getVenue`, `newVenue`, `openVenue { path }`, `saveVenue { path? }` (no path saves in place), `editVenue { edit }` with edits `setStage`, `putUniverse`, `removeUniverse`, `putFixture`, `moveFixture`, `removeFixture`. Events: `venue { patch, path?, unsaved }` after every change, and `venueDone { errors }` replying to each request. A rejected edit leaves the patch unchanged. `putFixture` embeds the library Profile when the patch has none; the patch's own copy wins.
- Files: main shows native Open/Save dialogs (`window.dialogs`, `.lcvenue` filter). The engine reads and writes the path (`diskVenueFiles`, written through a temp file).
- Pure helpers in `src/shared/venue-patch.ts`: `moveFixture` (Zone follows the position unless overridden) and `fixturesInUniverse`.
- UI (`src/renderer/src/venue/`, the default tab): New / Open / Save / Save As with an unsaved marker, plus confirmation before discarding. Also: stage bounds, Universes with a free-text Output id (blank is unmapped), and adding a Fixture from the patch's or the library's Profiles at the next free address. Fixtures drag on a top-down SVG plan (Stage Left on the right, Front row below the stage edge, 0.05 m snap). The caption shows the live Zone while dragging. A Fixture form edits name, mode, Universe, address, x/y/height, Role override and Zone override. Removing a Universe that has Fixtures lists them and asks first.
- Renderer request ids are shared (`src/renderer/src/engine-request.ts`), so Profile Library and Venue Patch replies cannot cross.
- Tests at the agreed seams: engine Venue Patch commands through `createEngine` with fake files, and the two pure helpers. `npm test`, `typecheck`, `lint`, `format:check` and `build` pass. The UI and the native dialogs were not run: the devcontainer has no display.

Acceptance:

- Dragging a Fixture updates its suggested Zone unless overridden: tested in `venue-patch.test.ts` and `engine.test.ts`.
- Removing a Universe that has Fixtures asks for confirmation: `window.confirm` in `VenuePatchView`. It is UI only; the engine still removes the Fixtures without asking.

Notes for later issues:

- Check on the Windows host (human): Open/Save dialogs, dragging, and the Output field after New/Open.
- "Add Universe" adds the next number after the highest one. A specific number, such as one removed earlier, cannot be added yet.
- Closing the window with unsaved changes does not ask. The current patch is not restored on the next start.
- Unapplied edits in the Fixture form are dropped when the engine updates that Fixture (for example by a drag).
- The engine routes each Venue command by name in `engine.ts`, `venue-session.ts` and `protocol.ts`. Consider a type guard if the command list grows.

### 2026-10-07: open points closed (agent, devcontainer)

Three of the notes above are now done:

- Closing with unsaved changes asks: Save / Don't Save / Cancel (native box in main). The renderer reports its unsaved state over IPC (`window.closeGuard`). Save runs the normal save flow, including the file dialog when the patch has no file; the window closes only once the save worked. Both views stay mounted, so this works from the Profile Library tab too.
- Universes are added by number. The field defaults to the lowest free number. The new `addUniverse` edit (and pure `addUniverse`) rejects a number already in the patch, where `putUniverse` would replace it. `freeUniverseNumber` gives the default. Both are tested at the agreed seams.
- The Fixture form keeps only the fields the user changed. Other fields follow the engine, for example the position after a drag. "Unapplied changes" shows with Apply and Revert. An edited field wins over a later engine change to the same field.

`npm test`, `typecheck`, `lint`, `format:check` and `build` pass. The close prompt and the form are not unit-tested (UI/main, by agreement), and they were not run here (no display).

Still open:

- Check on the Windows host (human): Open/Save dialogs, dragging, the Output field after New/Open, and the close prompt (Save, Don't Save, Cancel, and cancelling the Save dialog).
- The current patch is not restored on the next start.
- Venue command names are listed in `engine.ts`, `venue-session.ts` and `protocol.ts`.
