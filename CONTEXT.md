# LightCues

A Windows lighting controller for live music shows. Shows are programmed once and re-used across venues with different lighting rigs.

## Language

### Rig

**Fixture**:
A single lighting device occupying a block of DMX channels in one Universe.
_Avoid_: Figure, light, device

**Fixture Profile**:
The manufacturer/model definition of a fixture type: its modes, channels and capabilities.
_Avoid_: Fixture definition, personality

**Profile Library**:
The app-level collection of Fixture Profiles, imported from the Open Fixture Library or made by hand. A Venue Patch embeds copies of the Profiles it uses, so it does not depend on the library.
_Avoid_: Fixture library, catalogue

**Universe**:
One independent set of 512 DMX channels.

**Output**:
A physical or network DMX interface port to which a Universe is mapped.
_Avoid_: Interface, node, dongle

**Venue Patch**:
The per-venue description of the rig: which Fixtures exist, their Profile, Universe, address and position on stage.
_Avoid_: Rig file, setup

### Show

**Show**:
The venue-independent part of a project: Scenes, triggers and mappings. Combined with a Venue Patch to run.
_Avoid_: Project (ambiguous: a Show alone or a Show + Venue Patch)

**Scene**:
A reusable look or effect that targets Zones rather than specific Fixtures. Several Scenes can be active at once and are combined.
_Avoid_: Cue, preset

**Rule**:
One part of a Scene: a target (Zones × Roles) and the settings applied to it (intensity, colour, Direction, effect). Later Rules in a Scene override earlier ones.

**Effect**:
A time-varying change within a Rule, timed in beats. A spatial Effect is ordered by Fixture positions on stage (e.g. a left-to-right wave).
_Avoid_: Chase (a kind of Effect), FX

**Zone**:
A cell of the fixed stage grid: rows Front/Downstage/Midstage/Upstage × columns Stage Left/Centre/Stage Right × levels Floor/Overhead. The grid scales to each venue's stage bounds. A Fixture belongs to the Zone it is physically in, not the one it lights.
_Avoid_: Area, region

**Role**:
A Fixture's function, from a fixed list: Wash, Spot/Beam, Blinder, Strobe, Pixel/Bar, Effect. Used alongside Zones to target Rules.
_Avoid_: Type, group

**Direction**:
A named aim from a fixed vocabulary (Down, Audience, Up, Cross), recorded per moving Fixture in the Venue Patch and referenced by Scenes.
_Avoid_: Position, preset, palette

**Layer**:
A slot that holds at most one active Scene. Activating a Scene replaces the active Scene in its Layer; different Layers stack.

**Trigger**:
A mapping from an incoming MIDI message to a Scene action: Go (activate and stay), Flash (active while held) or Release (clear the Layer).

**MIDI Input**:
The MIDI port Triggers listen to, chosen per machine and kept between runs. When it is lost, the current look holds until it returns.
_Avoid_: MIDI device, controller

**Base Look**:
The Scene designated as the safe fallback look, available from the Fallback Panel at any time. Going to it clears every other Layer.

**Fallback Panel**:
The always-visible manual controls that need no MIDI: Blackout, Base Look, Grand Master and a few Scene buttons chosen per Show, each with a keyboard shortcut. Also shows the MIDI Input status.
_Avoid_: Manual panel, fader panel

**Blackout**:
Takes every Fixture's intensity to 0 until turned off, in Blind too. The active Scenes stay active.

**Default Colour**:
The colour a Show gives Fixtures where no Rule sets one. White unless changed.

**Grand Master**:
A global intensity scaler applied after all Scenes are combined.

**Monitor**:
The default mode, where the preview mirrors exactly what is being sent to the rig.

**Blind**:
A mode where the preview updates but nothing is sent to the rig, except Blackout.
_Avoid_: Offline, preview mode

**Venue Check**:
A report, produced when a Show is combined with a Venue Patch, listing Scenes whose targets are missing or only approximated in that rig.
