# Screenshots and a demo GIF

Status: ready-for-human

Blocked by: 02, try-without-hardware/03

See spec, "Screenshots". Capture is manual on Windows. An agent can do the README wiring and compression.

## Fix

1. On Windows, at 100 % display scaling, window about 1600 × 1000. Open the example.
2. Capture: Perform (with 2 Layers active), Venue Patch stage plan (a moving head selected, showing Direction lines), Scene editor (a Rule with an Effect), Profile import (OFL or GDTF dialog with a result).
3. Record 10 s or less: fire 3–4 Scenes from a MIDI controller or loopMIDI, Perform view visible. Export as GIF (under 5 MB) or MP4.
4. Save to `docs/images/` as `perform.png`, `venue-patch.png`, `scene-editor.png`, `profile-import.png`, `demo.gif`.
5. Agent: compress the PNGs losslessly (e.g. `oxipng`), add them to the README with alt text and captions.

## Acceptance

- Images render on the GitHub repo page, in the dark and the light GitHub theme.
- Total size of `docs/images/` under 8 MB.
- No personal data in the images: no real venue names you don't want public, no user folder paths in title bars or dialogs.
