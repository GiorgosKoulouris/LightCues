# The Speed limit steps up the length

A movement Effect runs at the Tempo, so a short length at a high Tempo asks a moving Fixture to turn far faster than it can: a 45° Pan sweep at 1/4 beat and 140 BPM peaks at about 2,600°/s. The Fixture loses steps and wobbles. A fixed, app-wide Speed limit of 300°/s on each axis applies to every movement Effect. An Effect that would go faster runs at the shortest longer Effect length that fits, with its size and beat lock kept. Only at 16 beats does the size shrink.

Playback holds the length per active Effect. It switches only on a beat that is a whole multiple of the longer of the two lengths, where both are at the same point in their cycle, Spread delays included, so no Fixture jumps. It steps back down only at 90% of the limit or less, so a drifting Tempo does not make it flip. Scene resolution stays pure: it is given the length and size to run each Effect at.

## Considered Options

- Clamp each frame's movement to the limit: always safe, but it flattens the shape into a slewed triangle and drifts off the beat.
- Shrink the size: keeps the speed and the beat, but a limited sweep turns into a twitch, and the look loses its scale.
- A max speed per Profile or Fixture: closer to each Fixture, but Profiles have no such data, from GDTF, Open Fixture Library or by hand.

## Consequences

- Most fast, small Effects at a club Tempo are limited: 300°/s allows about 6° at 1/4 beat at 120 BPM. 300°/s is conservative for beams; changing it is one constant.
- A limited Effect runs over the limit until the next boundary of its new length, up to 16 beats, when the Tempo jumps up.
- The limited length is not saved. A Show runs as programmed at a lower Tempo.
- Direction changes, crossfades, the Focus Check and the jump when Freeze ends are not limited. The Fixture's own speed handles them.
