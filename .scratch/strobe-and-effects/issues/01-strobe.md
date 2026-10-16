# Strobe as a Rule setting

Status: ready-for-agent

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
