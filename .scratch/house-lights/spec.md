# House Lights

Some venues put their own lights (bar, ceiling) on a Universe or Output the app drives. Today the app takes over the whole Universe, so those lights go to 0 on launch. We need to patch them, keep them lit, and change them during a gig: dim for the show, bring them up after.

## Scope

1. House Lights, House Groups and the Startup look in the Venue Patch (issue 01).
2. House Preset slots in the Show (issue 02).
3. Per-slot house looks in the Venue Patch, and the Venue Check (issue 03).
4. Firing House Presets: MIDI, Perform and the Fallback Panel (issue 04).

Out of scope: stage visualisation of House Lights, per-Group faders, movement or any attribute beyond intensity and colour.

## Decisions (2026-10-15)

### Terms

- **House Light**: a Fixture belonging to the venue, not the show rig. Patched like any Fixture (Profile, mode, Universe, address) but with no stage position, Zone, Role or Mounting.
- **House Group**: a named set of House Lights (bar, ceiling). Each House Light is in exactly one Group.
- **House Preset**: a named slot in the Show, fired by MIDI or a button.
- **House look**: per-Group intensity and colour, defined in the Venue Patch for one House Preset or as the Startup look.
- **Startup look**: the house look a Venue Patch sends from launch.

"Scene" stays reserved for Show Scenes. "Area" stays avoided (it is a Zone synonym).

### Where things live

- House Lights, House Groups, the Startup look and the house looks live in the Venue Patch. They belong to the venue.
- House Presets live in the Show: an ordered, named list of at most 8 slots, each with a fade time (seconds) and an optional MIDI note. The DAW session fires the same slots at every venue; each venue decides what they look like. Extends ADR 0001; recorded as ADR 0013.
- A house look is keyed by House Preset id. The Venue Patch keeps looks for slots the current Show does not have.

### Separation from the show engine

- Scenes, Rules, Effects, Default Colour, Directions and the Venue Check's Scene checks never touch House Lights.
- Nothing global affects House Lights: not Blackout, not Grand Master, not Freeze, not Blind. They always send.
- Stage Fixtures and House Lights share the address-overlap check.
- Intensity and colour follow the same rules as stage Fixtures: colour is ignored on a dimmer-only Profile, and RGB is scaled where there is no intensity channel. Other channels stay at their defaults.

### House looks

- A house look lists some Groups, each with intensity (0–1) and colour (same Colour model as Rules). Groups not listed stay where they are.
- The Startup look is sent from launch and on opening or replacing a Venue Patch. With no Startup look set, House Lights are at full white.

### Firing

- One House Preset at a time. Firing one crossfades from the current house state over the slot's fade time.
- A House Preset's MIDI note only does Go. A note cannot be both a Scene Trigger and a House Preset note; validation rejects it.
- A House Preset this Venue Patch has no look for does nothing; the Venue Check lists it as not set up in this venue.
- Replacing the Show keeps the house state. Opening or replacing the Venue Patch goes to its Startup look.
- Firing is not undoable. Editing House Presets and house looks is.

### UI

- Venue Patch editor: a House tab with Groups and their House Lights (same patch fields as other Fixtures, minus position, Zone, Role, Mounting), the Startup look, and one look per House Preset. With a Show loaded, slots show by name. Looks for slots not in that Show are marked "not in this Show" with a delete button. With no Show, only the Startup look and stored looks show.
- Editing a look previews it live on the rig. Leaving the tab restores the house state from before.
- Look editor: per Group, a "set in this look" checkbox, an intensity slider and the Rule colour control.
- Show editor: a House Presets list (name, fade, MIDI note), next to Triggers.
- Perform: a small House section with a button for Startup and one per House Preset. The last fired is highlighted, during the fade too.
- Fallback Panel: the House Preset buttons too, with Shift+1–8.

## Order

01 and 02 are independent. 03 needs both. 04 needs 03.
