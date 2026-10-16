# Colour Effects

Status: ready-for-human
Blocked by: 02

See spec, "Effect slots" and "Colour Effects".

## Work

- `src/shared/show.ts`: colour Effect: 2–4 colours with Step or Fade, or Rainbow; length, Spread. A Rule with both a colour and a colour Effect is invalid. Validation.
- Engine: a pure function giving the colour at a beat and Spread delay.
- `src/engine/scene-resolution.ts`: the Effect's colour is the Look's colour. It crossfades from the previous colour over the fade-in. None stops a lower Layer's colour Effect. Spread orders every targeted Fixture. Wheel Fixtures snap to the nearest slot.
- Freeze holds it (same beat).
- Rule editor: Colour / Colour Effect switch; colour list editor (reuse the Rule colour control), Step/Fade, Rainbow.
- Preview animates it.
- CHANGELOG line.

## Acceptance

- Tests: Step and Fade with 2 and 4 colours; Rainbow; Alternate with 2 colours gives odd/even; fade-in from a plain colour; None; Freeze; colour plus colour Effect rejected; wheel Fixture snaps.
- App test: set a two-colour Step Effect on a Rule.
- `npm run check` passes.

## Comments

### 2026-10-16: implemented

Done on `dev`. `npm run check` passes. Left for a human: on a real Output, check a Step and a Fade at 1/2 and 1 beat at a fast Tempo, on an RGB(W) Fixture and on a colour-wheel Fixture (Smart Beam). A wheel takes time to turn, so a fast Step or a Fade may blur, and a Fade snaps from slot to slot. Check a colour Effect fading in over another Layer's colour. Then set `resolved`. A test show is at `temp/Colour Effects test.lcshow` (not committed).

Decisions:

- **Type:** `ColourEffect` is `{ length, spread }` plus `{ shape: 'Step' | 'Fade', colours }` or `{ shape: 'Rainbow' }`. Rainbow takes no `colours` field. `COLOUR_SHAPES`, `MIN_EFFECT_COLOURS` (2), `MAX_EFFECT_COLOURS` (4). `Rule.colourEffect` is `EffectSlot<ColourEffect>`. The file reader allows its fields, and each colour's, from v5 only.
- **Colour plus colour Effect:** invalid, None included. A plain colour already stops the colour Effects below, so colour + None says nothing more.
- **Engine:** `colourEffectMix(effect, beat, delay)` in `effects.ts` gives `{ from, to, p }` Colours, and scene resolution blends their levels. This keeps `effects.ts` free of `ColourLevels`, which `scene-resolution.ts` owns. Step holds each colour for 1/N of the cycle. Fade spends that time fading to the next colour, and the last fades back to the first. Rainbow is hue 0–360 at saturation 1. Spread orders every targeted Fixture, as for intensity.
- **Combining:** a look carries its plain `colour` and an `effectColour`: the Effect's colour, or None. A plain colour in a Rule also sets None, so the last change wins between plain colours and Effects across Rules and Layers. None shows the plain colour under it, or else the Show's default colour.
- **Fade-in:** the Effect's colour fades from the one before, or the one below. A None fades back to the plain colour. If a new Scene cuts off a colour fade, that fade keeps fading under the new one, over the Layers below. A cut-off movement or intensity fade is still taken as over still or steady. Plain-to-plain colour fades are unchanged.
- **Wheel:** nothing new. The shown colour snaps to the nearest slot each frame.
- **Freeze, preview:** nothing new. A playback test covers Freeze.
- **UI:** the Rule card has a Colour / Colour Effect switch. Switching drops whichever is set. The Colour Effect picker has Not set, None, Step, Fade and Rainbow. A Step or Fade lists 2–4 colours with the Rule colour control, and has Add colour and Remove buttons. A new one is red and blue over 2 beats, In sync. Rainbow drops the colours. Step and Fade keep them.
- **Docs:** CONTEXT.md **Effect** describes colour Effects. One CHANGELOG line, and the README Rule step.
- **Not done:** the switch is a local copy of the `ModeSwitch` style. A shared segmented control in `ui/` would be a separate tidy-up.
