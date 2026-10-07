# MVP: usable at a gig

Glossary: [CONTEXT.md](../../CONTEXT.md). Decisions: [ADR 0001](../../docs/adr/0001-venue-independent-shows.md), [ADR 0002](../../docs/adr/0002-electron-with-separate-engine-process.md).

## Goal

Run a live band show where a DAW on a separate laptop fires Scenes over MIDI (rtpMIDI), and LightCues outputs DMX through a USB interface to whatever rig the venue has.

## Scope

1. Fixture Profiles: OFL import, in-app library, manual editor.
2. Venue Patch: stage bounds, Fixtures with Profile + mode, Universe, address, X/Y position, height, Role, Zone. Top-down editor.
3. Outputs: Enttec DMX USB Pro protocol over serial (also DMXking ultraDMX). Several Outputs at once; each Universe maps to one Output.
4. Show: flat Scene library with tags. Scenes hold Rules (Zones × Roles → intensity, colour). Each Scene has a Layer and a fade-in time.
5. Engine: resolves active Scenes against the Venue Patch into DMX frames at ~40 Hz. HTP for intensity, LTP for other attributes. Colour is translated per Fixture (RGB/RGBW/RGBAW/colour wheel).
6. MIDI Triggers: note → Scene with Go / Flash / Release. Velocity ignored. Any MIDI input port (rtpMIDI shows up as a normal port).
7. Preview: top-down and front elevation. Monitor and Blind modes.
8. Fallback panel: Blackout, Base Look, Grand Master, a few Scene buttons, keyboard shortcuts. If MIDI input drops: hold the current look and warn.
9. Files: `.lcshow` and `.lcvenue`, versioned JSON. The Venue Patch embeds copies of its Fixture Profiles.

## Out of scope (later, in order)

Beat-synced Effects + MIDI clock → Directions and movement → spatial Effects → Venue Check → Art-Net/sACN → 3D view → MIDI-controller busking.

## Architecture constraints

- Electron + TypeScript. The engine runs in its own Node process (Electron utilityProcess); the UI talks to it only through a typed message contract.
- Scenes never store raw DMX values or Fixture IDs.
- The engine is testable without hardware: (Show, Venue Patch, active Scenes, time) → frames.
