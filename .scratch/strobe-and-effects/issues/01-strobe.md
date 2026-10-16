# Strobe as a Rule setting

Status: ready-for-human

See spec, "Strobe", "Show file", "Docs" and "UI".

## Work

- `src/shared/show.ts`: `Rule.strobe?`, one of Off, Slow, Medium, Fast, 1, 1/2, 1/4 beat. Validation.
- `src/engine/scene-resolution.ts`: strobe joins the Look. Later Rules and higher Layers override it; Off counts as a value. It snaps at Scene start, not crossfaded. `channelPoint` drives `strobe` ranges at the rate, clamped to the `hz` span (1–20 Hz assumed without one), and `strobeSpeed` channels when the strobe range is elsewhere. Off and absent keep `shutter: open`. Beat values convert to Hz from the current Tempo. Not held by Freeze.
- `src/shared/venue-check.ts`: Scenes that strobe a Fixture with no strobe channel, or with no Hz span, as approximated. Show it where the existing approximations show.
- Rule editor: Strobe picker.
- Preview: strobing Fixtures flash at their rate, capped at 4 Hz.
- `CONTEXT.md`: **Strobe** term; strobe in **Rule** and **Venue Check**.
- ADR 0014: strobe on the Fixture's clock.
- CHANGELOG line.

## Acceptance

- Tests: validation; override across Rules and Layers, including Off over a lower strobe; DMX value per rate on a span, on no span, clamped above and below; beat rate follows a Tempo change; Fixture with Shutter and Ring Strobe drives both; `strobeSpeed` channel; Blackout gives dark; Freeze doesn't stop it; Venue Check entries; file round-trip.
- App test: set a strobe rate on a Rule.
- `npm run check` passes.

## Comments

### 2026-10-16: implemented

Done on `dev`. `npm run check` passes. Left for a human: check strobe on a real Output with a strobing Fixture, e.g. the Smart Beam's Shutter and Ring Strobe (Windows host only). Then set `resolved`.

Decisions:

- **Field:** `Rule.strobe?: StrobeRate`, with `STROBE_RATES = ['Off', 'Slow', 'Medium', 'Fast', 1, 0.5, 0.25]`. Beat values are numbers in beats, like Effect lengths. `STROBE_HZ` gives the named rates. `.lcshow` stays v5; a v4 file with `strobe` is rejected as an unknown field.
- **`src/shared/strobe.ts`:** `strobeHz(rate, bpm)` and `strobeDrives(channels)`, used by both the engine and the Venue Check. Per channel, a drive is either `rate` (across the strobe ranges with a Hz span, else all of them at an assumed 1–20 Hz) or `on`. A strobe range with no span, on a Fixture with a `strobeSpeed` range on another channel, only turns strobe on (set to the range's middle), and the speed channel takes the rate. A strobe range with its own span is driven by rate even when a speed channel exists. A channel with only `strobeSpeed` counts as a strobe channel.
- **Range choice:** the first range whose span holds the rate, else the nearest, clamped. On the Smart Beam's Shutter that is 64–95 (plain strobe), not the pulse or random ranges.
- **Engine:** strobe joins the Look and combines last-changed-wins, like colour. During a fade the Layer takes the new Scene's strobe at once. The Fixture strobes only while its intensity is over 0, so Blackout and intensity 0 give a dimmer at 0 and the shutter open, as when not strobing. Strobe overrides `shutter: open` on the same channel. Wheel-slot channels are not strobed.
- **Tempo:** `resolveFrames` and `resolveLights` take `bpm` after `beat`, defaulting to 120 (`DEFAULT_BPM`, now exported from `tempo.ts`). `createPlayback` gets `bpm()`, which reads the live Tempo, so Freeze (which holds only the beat) doesn't stop strobe or its beat rates.
- **Preview:** `FixtureLight.strobe` is the rate in Hz, set only on a lit Fixture with a strobe channel. The marker, the front beam and the top-down beam blink at the rate, capped at 4 Hz (`strobeBlink.ts`, CSS animation). With `prefers-reduced-motion` they stay steady.
- **Venue Check:** `fixtureApproximatedStrobe` / `approximatedStrobes` give `{ fixtureId, scenes, approximation: 'noStrobeChannel' | 'assumedHzSpan' }`. A Scene counts when its last Rule that targets the Fixture with a strobe rate sets one other than Off. Shown in the Fixture inspector as "Approximated strobe", next to Approximated aims.
- **Rule editor:** a Strobe select after the movement Effect: Not set, Off, Slow (2 Hz), Medium (6 Hz), Fast (12 Hz), 1 beat, 1/2 beat, 1/4 beat.
- **Docs:** CONTEXT.md **Strobe** (avoids "Flash", the Trigger mode), Rule and Venue Check; ADR 0014; the README's Rule step; a CHANGELOG line, and the file-version line names strobe.

