# Try without hardware

Batch 4 of the 2026-10-09 repo plan.

Today, seeing anything needs a Venue Patch built by hand. Seeing real output needs an Enttec-protocol interface. A new user can't get from download to "it works" without a rig. Tests can't check DMX frames end to end in the real app.

The 2D Preview with beam lines (`src/renderer/src/show/Preview.tsx`, `BeamLines.tsx`) already exists. It shows the resolved look, not what is sent to an Output.

## Scope

1. A Virtual Output (issue 01).
2. A DMX channel monitor (issue 02).
3. A demo Venue Patch and Show, opened from the app (issue 03).
4. An end-to-end smoke test on Windows CI (issue 04).

Out of scope: the 3D view (ADR 0002), Art-Net/sACN Outputs.

## Decisions (2026-10-09)

### Virtual Output

- An Output with id `virtual`, always listed, state `sending` while a Universe is mapped to it. It needs no port.
- Any number of Universes can map to it. That is the one difference from a real Output, which takes one Universe.
- It keeps the last frame per Universe for the channel monitor and for tests. It is not saved anywhere else.
- A Venue Patch saved with a Universe on `virtual` reopens the same way on any machine.

### Channel monitor

- A panel in the Venue Patch view: pick a Universe, see 512 values in a grid (e.g. 32 × 16). Each cell shows the value and the Fixture that owns the channel, on hover.
- It shows what is sent, for any Output, real or virtual. In Blind it shows what the Outputs get, not the Blind preview.
- The engine sends frames for the monitored Universe only while the monitor is open, at most 10 times a second.

### Demo content

- A small rig: 4 front wash PARs, 2 upstage overhead moving heads, 2 floor blinders, 1 multi-Cell LED bar. It covers every Role, several Zones, Directions and Cells.
- Profiles from Open Fixture Library. Its fixture data is MIT licensed: check this, and credit it in the third-party notices. Don't use the FOS/ADJ fixtures in `fixtures/`.
- All Universes map to `virtual`.
- A Show with about 8 Scenes: Intro, Verse, Chorus, Blinder hit, Circle movement, L→R wave, Base Look, Outro. Triggers from note C3 upwards. Use Go, Flash and Release at least once each. Scene names say what they show off.
- Ships in the installer under `resources/examples/`. Help → "Open example" opens both. Main grants the paths (ADR 0010).
- An example opens as unsaved-new: Save asks for a location, like Save As. The install folder is replaced on update, so edits there would be lost.

## Order

01, then 02 and 03 in any order, then 04.
