# House Presets in the Show, house looks in the Venue Patch

Some venues put their own lights (bar, ceiling) on a Universe the app drives. These House Lights are patched in the Venue Patch, in House Groups, and kept apart from the show engine: Scenes never target them, and Blackout, Grand Master, Freeze and Blind do not apply to them. A stage blackout must not darken the bar, and the room must stay controllable while programming blind.

What the room does during a gig (dim for the show, up after) is a Show decision, but what "dim" means is a venue one. So the Show holds an ordered list of named House Preset slots, each with a fade and an optional MIDI note, and each Venue Patch holds a house look per slot: intensity and colour per House Group. The DAW session fires the same notes at every venue, as ADR 0001 intends for Scenes. A slot a venue has no look for does nothing and is listed in the Venue Check.

The Venue Patch also holds a Startup look, sent from launch, because the app takes over the whole Universe and must not switch the bar off before a Show is loaded.

## Considered Options

- House presets and their MIDI notes both in the Venue Patch: simpler, but MIDI would be remapped at every venue.
- Fixed house looks in the Show (Full, Dim, Off) scaled per Group by the venue: portable, but fixes the vocabulary.
- House Lights as ordinary Fixtures targeted by Scenes: needs a Zone or Role for them, and Blackout and Blind would hit the room.
