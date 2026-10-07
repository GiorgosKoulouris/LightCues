# Venue Patch model and .lcvenue file

Status: ready-for-agent
Blocked by: 02

Venue Patch: stage bounds, Universes, Universe → Output mapping, Fixtures (Profile + mode, Universe, address, X/Y, height, Role override, Zone). Zone is suggested from position (thirds of stage bounds plus a Front row; Floor/Overhead by height) and can be overridden. Save/load versioned JSON with embedded Profile copies.

## Acceptance

- Overlapping and out-of-range addresses are rejected.
- Zone suggestion is tested for each grid cell and the Front row.
- A saved file opens on a machine without those Profiles in its library.
