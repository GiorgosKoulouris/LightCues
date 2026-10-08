# Venue-independent Shows

A project is split into a Show (Scenes, triggers, mappings) and a Venue Patch (Fixtures, addresses, Universes, stage positions). Scenes never reference individual Fixtures; they target Zones (a fixed stage grid) and Roles, resolved against the loaded Venue Patch at runtime. We tour between venues with partly or fully different rigs, and conventional consoles tie cues to fixture numbers, which forces re-programming per venue.

## Consequences

- A Scene can resolve to different Fixtures, or none, in each venue. Gaps are surfaced by a Venue Check rather than failing silently.
- Pan/tilt cannot be portable as raw values. Directions are computed per venue from stage geometry stored in the Venue Patch (ADR 0007).
