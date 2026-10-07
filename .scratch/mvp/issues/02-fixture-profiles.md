# Fixture Profile model and OFL import

Status: resolved
Blocked by: 01

Define the internal Fixture Profile model: manufacturer, model, modes, channels, capabilities (intensity, RGB/RGBW/RGBAW, colour wheel slots, pan/tilt, strobe), default Role. Import Open Fixture Library JSON into an app-level library.

## Acceptance

- Importing OFL fixtures covering dimmer-only, RGB, RGBW, colour wheel and moving head maps capabilities correctly.
- Unsupported OFL features are reported, not silently dropped.

## Comments

### 2026-10-07: implemented on `dev` (agent, devcontainer)

Done:

- Model in `src/shared/fixture-profile.ts`: `FixtureProfile` (id, manufacturer, model, default Role, modes). A mode is a list of DMX slots: `control` channels with 8-bit capability ranges, `fine` channels (16/24-bit low bytes, linked to their control channel), and `unused` slots.
- Capabilities: `intensity` and `emitter` (all 13 OFL colours, so RGB/RGBW/RGBAW and more) with an optional `level` span for inverted or partial dimmers; `wheelSlot` with a hex colour; `pan`/`tilt` with degrees; `shutter` (open/closed), `strobe` and `strobeSpeed` with Hz; `none`; `unsupported`.
- OFL import in `src/engine/ofl-import.ts`: `importOflFixture(json, manufacturer)` returns `{ profile, unsupported }`. OFL files do not name their manufacturer, so the caller passes it (the parent directory name in OFL).
- Unsupported features are reported, not dropped. An unsupported channel keeps its DMX slot as an `unsupported` capability, so addressing stays correct. Reported: unmapped capability types, non-Open/Color wheel slots, split slots, ShutterStrobe effects other than Open/Closed/Strobe, values in units we cannot place, switching channels, matrix channels. Modes with matrix inserts are skipped and reported.
- Default Role comes from the first OFL category that maps to a Role, else Wash.
- Profile Library in `src/engine/profile-library.ts`: import (replaces by id), get, list sorted by manufacturer then model, versioned JSON save/load. "Profile Library" is added to `CONTEXT.md`.
- Tests: dimmer, RGB, RGBW + strobe, colour wheel, 16-bit moving head, brightness levels, unsupported reporting, units, category → Role, non-OFL input, and the library. `npm test`, `typecheck`, `lint`, `format:check` and `build` pass.

Deferred:

- Library persistence on disk and engine protocol/UI wiring: issue 03.
- Decide in issue 03 whether re-importing a fixture may overwrite a hand-edited Profile. It currently replaces by id.
- Fine channels link to their control channel by name. If issue 03 allows renaming channels, keep the link in step.
- 16-bit capability ranges are reduced to 8-bit with `floor`, so adjacent ranges can share a coarse value at the boundary. Rare; not detected.
- Not read: channel `precedence`, `constant`, `highlightValue`, and colour temperature on wheel slots. The engine applies HTP/LTP by attribute (spec §5), so precedence is not needed.
- Matrix/pixel fixtures (OFL `matrix`, `templateChannels`) are reported, not imported. Pixel/Bar fixtures need this later.

