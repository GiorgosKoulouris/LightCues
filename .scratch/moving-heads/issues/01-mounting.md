# Mounting in the Venue Patch

Status: resolved

See spec, "Mounting".

## Acceptance

- `PatchedFixture` gains an optional Mounting: `hung | standing`, rotation (degrees), pan invert, tilt invert, pan offset, tilt offset (degrees). Absent means the defaults (Hung, 0°, no inverts, 0 offsets).
- Validation rejects non-finite numbers. Rotation is normalised to 0 to under 360.
- A helper says whether a Fixture is a mover (its mode has a pan or tilt channel).
- The Fixture Inspector shows Mounting fields for movers only: Hung/Standing, rotation with 0/90/180/270 quick picks, the two inverts and the two offsets. Instant commit and undo like the other fields.
- `.lcvenue` goes to version 2. Version 1 files load without Mounting.
- Tests: patch validation, file round trip, version 1 load, inspector shows fields only for movers.

## Comments

### 2026-10-08: implemented

- `src/shared/venue-patch.ts`: `Mounting` (`mount: 'Hung' | 'Standing'`, as in `CONTEXT.md`), `DEFAULT_MOUNTING`, `fixtureMounting`, `isMovingFixture` (mode has a control channel with a pan or tilt range), `normalRotation`.
- `putFixtures` normalises rotation into 0 to under 360. Validation rejects non-finite rotation/offsets, an unknown mount, non-boolean inverts, and a stored rotation outside 0 to under 360. A file is not normalised on load: saved files are always normalised, so a bad value there is an error.
- A Mounting left on a Fixture whose mode loses pan/tilt is kept and saved, but ignored. Aim code (issue 02) must gate on `isMovingFixture`.
- `.lcvenue` is version 2. Versions 1 and 2 load.
- Fixture Inspector: a "Mounting" fieldset for a single moving Fixture. Mounted (Hung/Standing), Rotation (any number, normalised as typed: 450 commits 90), 0/90/180/270 quick picks, Invert pan/tilt, Pan/Tilt offset. Each commits at once through `putFixtures`, so undo works as for other fields. Not offered for a multi-selection.
- Tests: `venue-patch.test.ts` (defaults, normalisation, validation, `isMovingFixture`), `venue-file.test.ts` (round trip, version 1 load, bad rotation), `VenuePatchView.test.tsx` (fields only for moving Fixtures, instant commit, rotation normalisation). `npm run check` green. Not tried in the running app.
