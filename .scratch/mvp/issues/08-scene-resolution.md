# Scene resolution engine

Status: resolved
Blocked by: 04, 07

Pure function: (Show, Venue Patch, active Scene per Layer, time) → DMX frame per Universe.

- Rules resolve to Fixtures by Zone × Role; later Rules override earlier ones.
- Layers combine with HTP for intensity, LTP for other attributes.
- Fades interpolate over the Scene fade-in time.
- Colour is translated per Fixture capability: RGB, RGBW, RGBAW, nearest colour-wheel slot, intensity-only fallback.
- Grand Master applies last, to intensity only.

## Acceptance

- The same Show resolves correctly against two different Venue Patches in tests.
- HTP/LTP, fades and colour translation each have tests.

### 2026-10-07: from issue 06 (agent)

Outputs send whatever `frame(universe)` returns, 512 channels, channel 1 first (`createOutputs` in `src/engine/outputs.ts`). `engine.ts` passes a blackout frame for now. Replace it with the resolved frame per Universe.

### 2026-10-07: from issue 07 (agent)

The Show model is in `src/shared/show.ts`. A Rule with no `zones` / `roles` targets every Zone / Role. An absent `intensity` or `colour` leaves that attribute to earlier Rules. Colour is `{ hue, saturation }` (hue 0–<360, saturation 0–1) or `{ swatch }` from `SWATCHES`. The swatch list was chosen in 07 without RGB values; define them here. `fadeIn` is in seconds.

## Comments

### 2026-10-07: decisions (user)

- Fades: per Layer, crossfade from what that Layer showed at the moment of change (also mid-fade) to the new Scene, over the new Scene's fade-in. Clearing a Layer is instant.
- LTP across Layers: the Layer whose Scene changed most recently wins. Layer order stays display-only.
- Tests at one seam: the pure resolver. Outputs keep sending blackout; issues 09/10 wire the Show and active Scenes into the engine.
- A Fixture whose colour no Rule sets keeps its colour channels at their Profile defaults.

### 2026-10-07: implemented on `dev` (agent, devcontainer)

Done, in `src/engine/scene-resolution.ts` (pure, immutable):

- `ActiveScenes`: per Layer id, `{ scene, since, from? }`. Times are in seconds. `from` is what the Layer showed before, kept only while the new Scene is fading in.
- `activate(active, show, sceneId, time)` replaces the Scene in its Layer. An unknown Scene id is ignored. `clearLayer(active, layerId)` clears at once.
- `resolveFrames(show, patch, active, time, grandMaster = 1)` returns one 512-channel frame per Universe in the patch.
- Rules match by Zone × Role. Later Rules override per attribute.
- Intensity is HTP across Layers. Colour is LTP by `since`, with ties going to Layer order.
- Fades are linear. Intensity lerps, and an absent intensity counts as 0. Colour lerps in RGB+UV when both looks set it; otherwise the one that sets it holds until the fade ends.
- The Grand Master multiplies combined intensity.
- Colour per Fixture:
  - A UV emitter takes UV.
  - White, then amber (taken as RGB 1, 0.75, 0), take what they can. RGB mixes the rest.
  - A colour wheel goes to the middle of the nearest slot by RGB distance.
  - A Fixture without red, green and blue emitters ignores colour; its emitters carry intensity only.
  - Lime, cyan, magenta, yellow, indigo and warm/cold white on RGB Fixtures are set to 0 when a colour is set.
- No dimmer: intensity scales the emitters, including Profile defaults when no colour is set.
- Encoding:
  - Intensity and emitters honour capability ranges and `level` spans.
  - A channel with a fine channel is set in 16 bits.
  - A shutter channel is set to the middle of its "open" range.
  - Other channels take their Profile defaults; `unused` channels are 0.
- Swatch RGB values are defined in `SWATCH_LEVELS`. UV is RGB 0.3, 0, 1 plus UV.
- `sameZone` is added to `venue-patch.ts`.

Acceptance:

- One Show is resolved against two Venue Patches (one with an RGBAW wash and a dimmer strobe, the other with a two-Universe wheel spot and an RGB strobe): `scene-resolution.test.ts`.
- HTP, LTP (with tie), fades (from clear, crossfade, interrupted, clear), and colour translation (RGB, RGBW, RGBAW, wheel, intensity-only, white-only, swatches, UV) each have tests.

`npm test`, `typecheck`, `lint`, `format:check` and `build` pass.

Open points for the user:

- When a Layer that sets no colour fades in on top, colour does not fade, because LTP passes at activation. Two cases:
  - A new Layer that sets colour shows its colour at once while its intensity fades up.
  - A Scene that replaces a coloured one with no colour holds the old colour, then snaps to the lower Layer's colour when the fade ends.
  
  To fix this, crossfade colour across Layers as well. That is not done yet.
- An RGB Fixture with a dimmer and colour defaults of 0 stays dark under an intensity-only Scene. This follows the "Profile defaults" decision.
- Not wired into the engine. Outputs still send blackout (see issues 09/10).

### 2026-10-07: closed open points (user)

- Colour across Layers stays as is: colour snaps when a Layer takes LTP; only intensity fades. No cross-Layer colour crossfade.
- Unset colour keeps Profile defaults, also on RGB Fixtures with a dimmer. A Scene must set colour to light Fixtures whose colour defaults are 0.
