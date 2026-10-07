# Scene resolution engine

Status: ready-for-agent
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
