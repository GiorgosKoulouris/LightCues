# Strobe runs on the Fixture's clock

A Rule's strobe sets only a rate on the Fixture's strobe channels. The Fixture's own strobe circuit times the flashes. A beat rate (1, 1/2 or 1/4 beat) is turned into Hz from the current Tempo, so the rate follows the Tempo, but the flashes are not locked to the beat. Strobe needs no new timing in the engine and works on any Fixture with a strobe channel.

## Considered Options

- Flashes driven by the engine, by switching the shutter or dimmer on each beat or part of one: locked to the beat, but limited by the ~40 Hz DMX frame rate and the Fixture's response, uneven at high rates, and different from the fast, crisp strobe the Fixture makes itself.
- Strobe as an intensity Effect: the same limits, and it takes the intensity slot that pulses and chases need.

## Consequences

- Strobe is not phase-locked to the music. Two Fixtures at the same rate drift apart.
- The DMX value comes from the strobe range's Hz span. A Profile without one is taken as 1–20 Hz, slow to fast, and listed in the Venue Check, like a Fixture with no strobe channel.
- Freeze does not stop strobe, and strobe snaps on and off at Scene start rather than crossfading: a rate between two rates is not a look.
