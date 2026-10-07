# Show model and .lcshow file

Status: resolved
Blocked by: 01

Show: Scene library with tags, Layers, Triggers. Scene: Layer, fade-in time, ordered Rules. Rule: target (Zones × Roles), intensity, colour (hue/saturation or named swatch). Save/load versioned JSON. No Fixture IDs or raw DMX values.

## Acceptance

- Save/load round-trip is lossless.
- Schema version is checked on load.

## Comments

### 2026-10-07: decisions (user)

- Tests at two seams: the pure Show functions and `.lcshow` save/load. Engine/protocol wiring goes to issues 08/09.
- Rule target: `zones` and `roles` are optional. Absent means every Zone / every Role. An empty list is rejected.
- Every Trigger references a Scene. Release clears that Scene's Layer.
- The Show stores the Base Look as an optional Scene id.

### 2026-10-07: implemented on `dev` (agent, devcontainer)

Done:

- `src/shared/show.ts` (pure, immutable):
  - Types: `Show { layers, scenes, triggers, baseLook? }`, `Layer { id, name }`, `Scene { id, name, tags, layer, fadeIn, rules }`, `Rule { target: { zones?, roles? }, intensity?, colour? }`, `Colour = { hue, saturation } | { swatch }`, `Trigger { channel, note, scene, mode }`.
  - Units: `fadeIn` in seconds; `intensity` and `saturation` 0–1; `hue` 0 to under 360 degrees; MIDI channel 1–16, note 0–127.
  - An absent Rule setting leaves that attribute to earlier Rules and other Scenes.
  - Edits: `emptyShow` (one Layer), `putScene` / `removeScene`, `putLayer` / `removeLayer`, `putTrigger` / `removeTrigger`, `setBaseLook`. Changing calls return `{ show }` or `{ errors }`.
  - Removing a Scene removes its Triggers and clears it as Base Look. Removing a Layer removes its Scenes.
  - `putTrigger` replaces the Trigger on the same channel and note.
- `validateShow`: ids unique; Layer, Trigger Scene and Base Look exist; fade-in ≥ 0; tags non-empty, no surrounding spaces, no repeats; Rule values in range; Zones on the grid; Roles and swatches known; Trigger channel/note in MIDI range; mode known; one Trigger per channel and note.
- `src/engine/show-file.ts`: `saveShowFile` / `loadShowFile`, version 1. Load rejects unknown versions, malformed JSON, missing parts and invalid Shows with an `Invalid Show:` error.
- No Fixture ids or DMX values: the types have no place for them.
- `isZone` is now exported from `venue-patch.ts`.

Acceptance:

- Lossless round-trip: `show-file.test.ts` saves and loads a Show that uses every part of the model.
- Version check on load: `show-file.test.ts`.

`npm test`, `typecheck`, `lint`, `format:check` and `build` pass.

Notes for later issues:

- `SWATCHES` is a fixed list of 13 names (Red … White, Warm White, UV), chosen here. Issue 08 defines what each one resolves to. Change the list if needed.
- Errors name Scenes by name, not id. Two Scenes with the same name give ambiguous errors.
- Layer order is display order only. HTP/LTP across Layers is issue 08's concern.

### 2026-10-07: closed open points (agent)

- `saveShowFile` and `saveVenueFile` now validate and throw on an invalid Show or patch, so every saved file loads. The Venue session already reports save errors.
- `loadShowFile` rejects fields the Show model does not have (e.g. a Fixture id or DMX value in a Rule), listed by path: `unknown field "scenes[0].rules[1].fixtureId"`. `.lcvenue` load does not check unknown fields yet.
