# Public face

Batch 5 of the 2026-10-09 repo plan. Comes after `try-without-hardware`, so screenshots use the demo content.

The README is written for a developer. It mixes install steps with CI and security-scan details. It has no screenshots. Its Quickstart has gone stale: it says the window shows "Engine replied in N ms", a string no longer in `src/`, and it tells cloners to `git switch dev`. The app and installer use the default Electron icon. The GitHub "About" box is not set.

## Audience

Gigging musicians who download the installer. Not outside contributors (PRs by arrangement only). Developer details move to `docs/development.md`.

## Scope

1. App icon (issue 01).
2. `docs/development.md` and the README rewrite (issue 02).
3. Screenshots and a GIF (issue 03).
4. GitHub About text and topics (issue 04).

## Decisions (2026-10-09)

### README order

1. Name, icon, one-line pitch, hero screenshot (Perform).
2. What it does, in a gig's terms: your DAW fires the lights; a new venue means re-patching, not re-programming.
3. Requirements: Windows 10/11 x64, an Enttec DMX USB Pro or DMXking ultraDMX, optional MIDI (DAW, controller, rtpMIDI, loopMIDI).
4. Install, with the SmartScreen note until signing exists (`distribution/02`).
5. First Show: open the example (try without hardware), then the real path: import Profiles → patch the Venue → build a Scene → map a MIDI Trigger → Perform. One screenshot per step where it helps.
6. Troubleshooting: interface not found (FTDI driver, COM port), MIDI port missing (rtpMIDI, loopMIDI), where the logs are.
7. Links: glossary (`CONTEXT.md`), `docs/development.md`, `SECURITY.md`, license.

Moves to `docs/development.md`: Where to run what, Quickstart from source, Commands, CI, Security scan, Architecture, Contributing.

### Screenshots

- PNG, about 1600 px wide, dark, in `docs/images/`. Captured on Windows at 100 % scaling from the demo content, so they are reproducible.
- Views: Perform (hero), Venue Patch stage plan, Scene/Rule editor, Profile import.
- One GIF or MP4 of 10 s or less: MIDI fires Scenes, Perform and Preview react. Under 5 MB.
- Each image has alt text and a caption of 1–2 lines.

### Icon

- A simple SVG glyph (a beam or spotlight cone) on the app's dark background. The SVG in the repo is the source. The `.ico` (16–256 px) is generated from it.

### About text

> Windows lighting controller for live music. Program a Show once, run it at any venue: Scenes target stage Zones and Roles, not fixtures. MIDI/DAW triggers, Enttec DMX USB Pro, OFL and GDTF import.

Topics: `dmx`, `lighting-control`, `midi`, `electron`, `live-music`, `gdtf`, `open-fixture-library`, `enttec`.

## Order

01, 02, 03, 04. 02 can start before 03, with placeholders for the images.
