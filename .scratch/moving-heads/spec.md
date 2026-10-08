# Moving heads

Aim moving Fixtures at named Directions, move them between Directions over a Scene's fade, and run movement Effects to the Tempo. All of it venue-independent: aims are computed per venue from stage geometry (ADR 0007).

Today Rules set intensity and colour only. Pan/tilt channels are left at their defaults. Profiles already carry optional pan/tilt degree ranges. Stage positions (x, y, height) already exist in the Venue Patch. There is no Tempo source and no Venue Check yet.

Terms: Direction, Mounting, Default Direction, Effect, Spread, Tempo, Freeze, Focus Check (see `CONTEXT.md`).

## Scope

1. Mounting in the Venue Patch (issue 01).
2. Aim movers at a Direction: aim maths, Rule `direction`, Default Direction, Scene editor (issue 02).
3. Report approximated aims (issue 03).
4. Moves between Directions: fade, shortest pan path, snap when dark (issue 04).
5. Focus Check in the Venue Patch editor (issue 05).
6. Beam lines in the preview (issue 06).
7. Tempo: MIDI Clock and Tap Tempo (issue 07).
8. Movement Effects (issue 08).
9. Freeze on the Fallback Panel (issue 09).

## Decisions (2026-10-08)

### Directions

- Fixed vocabulary: Down, Audience, Up, Cross, Centre, Out. Not extensible by the Show.
- Down/Up: vectors straight down/up.
- Audience: each beam aims at a point straight out from its own x, at 1.7 m high, stage depth + 5 m in front of the downstage edge (y = −(depth + 5)). Beams are parallel.
- Cross: aims at the floor point mirrored across centre (−x, same y, height 0).
- Centre: every beam converges on centre stage (x 0, y depth/2) at 1.7 m.
- Out: away from centre into the audience: the Audience point pushed outward, x' = x + sign(x) × (stage width / 2). A Fixture at x = 0 aims like Audience.
- Head height and audience distance are constants for v1, not per venue.
- A moving Fixture is one with a pan or tilt channel in its mode. It uses the axes it has.

### Mounting

- Per moving Fixture in the Venue Patch: Hung | Standing, base rotation in degrees (0 = front of base faces the audience; quick picks 0/90/180/270), pan invert, tilt invert, pan offset and tilt offset in degrees.
- Defaults: Hung, 0°, no inverts, 0 offsets.
- The offsets apply to every Direction. There are no per-Direction overrides.

### Aim computation

- Pan/tilt is computed from stage position, Mounting and the Profile's pan/tilt degree ranges, then mapped to the channel's DMX range (coarse and fine).
- A Profile without a degree range on an axis assumes pan 540°, tilt 270°, and the aim is reported as approximated.
- An aim out of reach (beyond the tilt range, or needing a missing axis) is clamped to the nearest reachable aim and reported as approximated.
- Of the valid pan solutions, pick the one nearest the Fixture's current pan.
- Tilt 0 is the beam along the yoke axis (straight down when Hung, straight up when Standing), centre of the tilt range. Pan 0 is the centre of the pan range, with the beam tilted toward the base's front.

### Combining and timing

- `direction` and the movement Effect are separate Rule attributes, each combined "last changed wins", like intensity and colour.
- A Show has a Default Direction (Down unless changed) for movers no Rule aims, and as the base for a movement Effect with no Direction.
- A move between Directions takes the Scene's `fadeIn`, interpolating pan/tilt (not the 3D aim).
- A mover at 0 intensity snaps to its new aim instead of fading (reduced move-in-black). It has no knowledge of future Scenes.

### Movement Effects

- Shapes: Circle, Pan sweep, Tilt sweep, Ballyhoo (smooth random wander, deterministic per Fixture).
- Size in degrees (quick picks Small 5°, Medium 12°, Large 25°), around the base Direction's aim.
- Length in beats per cycle: 1, 2, 4, 8, 16.
- Spread across targeted Fixtures by stage position: In sync, Left→Right, Mirrored (centre out), Alternate.

### Tempo

- From MIDI Clock on the MIDI Input when present. Tap Tempo (Fallback Panel button and keyboard shortcut) sets it otherwise and overrides it.
- When the clock is lost, the last Tempo holds.
- Default 120 BPM before any clock or tap.

### Live control

- Fallback Panel gains Tap Tempo and Freeze. Freeze holds every movement Effect where it is. Directions still apply.
- Focus Check: a Venue Patch editor mode. Pick a Direction, and every mover goes there, open at full in white, on the real rig, in Blind too. Edits to position or Mounting show live. Blackout still wins. Ends when the editor is left.
- The preview draws each mover's beam as a line to where it lands on the floor or the audience plane, in its output colour. 2D only.

## Out of scope

- Show-defined or venue-specific Directions, per-Direction overrides.
- Head height or audience distance per venue.
- 3D aim interpolation, 3D preview.
- Figure-8 and Direction-step Effects.
- Effect speed/size masters on the Fallback Panel.
- In-app movement sequences over time. The DAW sequences Scenes through Triggers.
- True move-in-black with look-ahead.
- The full Venue Check report. Issue 03 exposes approximated aims for it.
