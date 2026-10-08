# Directions are computed from stage geometry

A moving Fixture's pan/tilt for each Direction is computed from its stage position, Mounting (Hung or Standing, base rotation, pan/tilt inversion, pan/tilt offset) and its Profile's pan/tilt ranges, not focused and stored per Fixture per Direction. Correcting one Fixture's placement in a venue then corrects every Direction and every Scene at once, and movement Effects can be sized in degrees that mean the same in every venue.

## Considered Options

- Calibrated palettes, as on conventional consoles: each mover focused to each Direction at every venue and stored. Exact, but a focus session per venue that grows with movers × Directions, and a slightly wrong Fixture has to be fixed once per Direction.
- Computed with per-Direction overrides: exact where needed, but overrides silently stop following corrections to placement, losing "fix once".

## Consequences

- An inaccurate position or Mounting gives wrong aims everywhere, so the Venue Patch editor needs a Focus Check against the real rig.
- Aims a Fixture cannot reach, and Profiles without pan/tilt ranges (540°/270° assumed), are approximated and reported in the Venue Check.
- A per-Fixture pan/tilt offset covers a fixture whose own zero is off; there are no per-Direction overrides.
