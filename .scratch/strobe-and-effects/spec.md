# Strobe and intensity/colour Effects

Rules can set intensity, colour, a Direction and a movement Effect. They can't strobe, pulse or cycle colour. A high-energy show (`.scratch/show-feature-gaps/`, gaps 1 and 2) fakes strobe with Flash Scenes and has the DAW sequence pulses note by note. This adds both to the app as a whole, for any rig.

## Scope

1. Strobe as a Rule attribute (issue 01).
2. Effect slots per attribute, None, and sub-beat lengths (issue 02).
3. Intensity Effects (issue 03).
4. Colour Effects (issue 04).

Out of scope: gobo, prism, frost, zoom, focus and sub-Zone targeting (still needs-triage in `show-feature-gaps`). Fixture programs and effect motors are wontfix.

## Decisions (2026-10-16)

### Strobe

- A Rule setting `strobe`, with these values: Off, Slow (2 Hz), Medium (6 Hz), Fast (12 Hz), or 1, 1/2 or 1/4 beat. A beat value is converted to Hz from the Tempo.
- The rate follows the Tempo, but the flashes are not locked to the beat. A fixture's strobe runs on its own clock, and DMX only sets the rate. Recorded as an ADR.
- Absent leaves strobe to earlier Rules and lower Layers, like any setting. Off stops their strobe.
- Every strobe channel on a Fixture is driven, e.g. the Smart Beam's Shutter and Ring Strobe. On a channel with `shutter: open`, Off sets open, as today.
- The rate is clamped to the range's `hz` span. A strobe range with no span is taken as 1–20 Hz, slow to fast across its DMX range. A `strobeSpeed` channel takes the rate when the strobe range sits on another channel.
- A targeted Fixture with no strobe channel stays steady.
- Venue Check: Scenes that strobe a Fixture with no strobe channel, or with no Hz span, are listed as approximated.
- Strobe snaps on and off at Scene start. It is not crossfaded. Freeze doesn't stop it. Blackout and intensity 0 still give dark.
- The preview flashes a strobing Fixture, at its rate but no faster than 4 Hz.
- The Profiles already parse `strobe` and `strobeSpeed`, so existing Venue Patches need no re-import.

### Effect slots

- A Rule has three Effect slots: movement (today's `effect`), intensity and colour. One Rule can sweep, pulse and cycle colour at once.
- Each slot is either absent, leaving it to earlier Rules and lower Layers, or None, which stops lower Layers' Effect of that kind. This is new for movement too.
- One list of lengths for every Effect: 1/4, 1/2, 1, 2, 4, 8, 16 beats.
- Every Effect kind uses Spread, with today's `spreadDelay`. Intensity and colour Effects order all targeted Fixtures, not just moving ones.
- Freeze holds every Effect. It already holds the beat Effects run to, so the new Effects freeze with it.
- On a Scene's fade-in, an intensity Effect's depth grows from 0 and a colour Effect crossfades from the previous colour. This matches how movement size fades in today.
- The preview animates intensity and colour Effects live.

### Intensity Effects

- Shape and depth (0–1). The Effect scales the Fixture's resolved intensity, which may come from another Scene, the way a movement Effect runs around a base Direction. At depth 1 it dips to 0; at depth 0.5 to half.
- Shapes: Pulse (sine), Ramp up, Ramp down, Square (half on, half off) and Chase.
- Chase is on for 1/N of the cycle, where N is the number of Spread positions among the targeted Fixtures, so one position is lit at a time. With In sync it is Square.
- On Fixtures without a dimmer, it scales the emitters, as intensity does today.

### Colour Effects

- A list of 2–4 colours, stepped or faded through over the cycle, or Rainbow (a hue cycle). Spread offsets each Fixture: Alternate with two colours gives odd/even.
- It replaces the Rule's colour. A Rule has a colour or a colour Effect, not both. The editor switches between them.
- Colour-wheel Fixtures snap to the nearest slot at each moment, as with plain colour.

### Show file

- `.lcshow` stays at version 5. v5 is unreleased (added on `dev` after v0.1.1), so these Rule fields join it. v4 files still read; their `effect` is the movement slot.

### Docs

- `CONTEXT.md`:
  - add **Strobe**;
  - make **Effect** cover movement, intensity and colour Effects;
  - make **Freeze** hold every Effect;
  - add strobe to **Rule**'s settings;
  - add strobe approximations to **Venue Check**.
- ADR 0014: strobe runs on the Fixture's clock, rate from the Tempo, not phase-locked.

### UI

- Rule editor: a Strobe picker (Off, Slow, Medium, Fast, 1, 1/2, 1/4 beat). Intensity and colour Effect pickers next to the movement `EffectPicker`, each with None. Colour has a Colour / Colour Effect switch.
- Effect length pickers show 1/4 and 1/2.

## Order

01 and 02 are independent. 03 and 04 need 02, and are independent of each other.
