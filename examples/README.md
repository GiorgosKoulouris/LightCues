# Example Venue Patch and Show

`demo.lcvenue` and `demo.lcshow` let you try LightCues without a rig. In the app, click **Open example**. Both files open as new and unsaved, so Save asks where to put them.

The rig is a small band stage, 8 × 6 m:

- 4 front wash PARs on a truss over the audience (Showtec Club Par 12/4 RGBW, RGBW mode).
- 2 moving heads hung upstage (Eurolite LED TMH-9, 12-channel mode). Head SL has the Effect Role.
- 2 blinders on the downstage edge (Showtec LED Blinder 2 COB, 2-channel mode). Blinder SL has the Strobe Role.
- 1 LED bar with 8 Cells on the floor upstage (Stairville LED Bar 240/8, 24-channel mode).

Both Universes map to the Virtual Output, so nothing needs hardware. Open the channel monitor in the Venue Patch view to see the DMX values.

The Show has 8 Scenes on 3 Layers. Triggers listen on MIDI channel 1:

| Note | Scene                     | Action  |
| ---- | ------------------------- | ------- |
| C3   | Intro: blue wash          | Go      |
| D3   | Verse: warm, amber centre | Go      |
| E3   | Chorus: full red          | Go      |
| F3   | Blinder hit               | Flash   |
| G3   | Circle movement           | Go      |
| A3   | L→R wave                  | Go      |
| B3   | L→R wave                  | Release |
| C4   | Warm white (Base Look)    | Go      |
| D4   | Outro: slow fade to blue  | Go      |

C4 is MIDI note 60. Without MIDI, use the Scene buttons in Perform or on the Fallback Panel.

## Regenerating

The files are built by `scripts/make-examples/demo.ts` with the app's own models. Run `npm run examples` after changing it or the file format. A test fails while the committed files are out of date.

## Fixture data

The Fixture Profiles are imported from [Open Fixture Library](https://open-fixture-library.org/) fixture files, kept as downloaded in `scripts/make-examples/ofl/` (commit `174eae5`, 2026-10-07). Open Fixture Library is MIT licensed:

```
MIT License

Copyright (c) 2017 Florian & Felix Edelmann

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
