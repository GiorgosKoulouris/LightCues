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

**Cell**:
One repeated section of a multi-cell Fixture (a pixel, a wash section). A Fixture Profile has no cell model: each Cell's channels are flattened into the mode, named e.g. "Red (Cell 2)". Not a Zone.
_Avoid_: Pixel, segment

**Profile Library**:
The app-level collection of Fixture Profiles, imported from Open Fixture Library or GDTF files, or made by hand. A Venue Patch embeds copies of the Profiles it uses, so it does not depend on the library.
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
A time-varying change within a Rule, timed in beats of the Tempo. A movement Effect (Circle, Pan sweep, Tilt sweep, Ballyhoo) runs around a base Direction, which may come from another Scene; its size is in degrees and its length in beats. Sequences over time are not Effects: the DAW sequences Scenes through Triggers. A spatial Effect is ordered by Fixture positions on stage (e.g. a left-to-right wave).
_Avoid_: Chase (a kind of Effect), FX

**Focus Check**:
A Venue Patch editor mode that sends every moving Fixture, open in white, to one chosen Direction on the real rig, in Blind too, so placement and Mounting can be corrected live. Blackout still wins. Ends when the editor is left.

**Spread**:
How an Effect is offset across the Fixtures it targets, by their stage positions: In sync, Left→Right, Mirrored (centre out) or Alternate.
_Avoid_: Phase, wings

**Zone**:
A cell of the fixed stage grid: rows Front/Downstage/Midstage/Upstage × columns Stage Left/Centre/Stage Right × levels Floor/Overhead. The grid scales to each venue's stage bounds. A Fixture belongs to the Zone it is physically in, not the one it lights.
_Avoid_: Area, region

**Role**:
A Fixture's function, from a fixed list: Wash, Spot/Beam, Blinder, Strobe, Pixel/Bar, Effect. Used alongside Zones to target Rules.
_Avoid_: Type, group

**Direction**:
A named aim from a fixed vocabulary (Down, Audience, Up, Cross, Centre, Out), referenced by Scenes. A moving Fixture is one with a pan or tilt channel; it uses the axes it has. Each moving Fixture's pan/tilt for a Direction is computed from its stage position and Mounting, not stored per Fixture, so correcting a Fixture's placement corrects every Direction at once. Down and Up are straight down and up; Audience points each beam straight out at the audience; Cross aims each beam at the mirror point across centre stage; Centre converges every beam on centre stage; Out points away from centre into the audience. An aim a Fixture cannot reach is approximated and reported in the Venue Check.
_Avoid_: Position, preset, palette

**Mounting**:
How a moving Fixture is physically installed, recorded in the Venue Patch: Hung or Standing, the rotation of its base, pan/tilt inversion, and a pan/tilt offset for a fixture whose own zero is off. With its stage position, enough to compute where it points.
_Avoid_: Orientation, hang

**Tempo**:
The beats per minute that Effects run to. Taken from the MIDI Input's MIDI Clock when present, otherwise set by Tap Tempo, which also overrides it. When the clock is lost, the last Tempo holds.
_Avoid_: BPM, speed

**Freeze**:
Stops every movement Effect where it is, until turned off. Directions still apply.

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
The always-visible manual controls that need no MIDI: Blackout, Base Look, Grand Master, Tap Tempo, Freeze and a few Scene buttons chosen per Show, each with a keyboard shortcut. Also shows the MIDI Input status.
_Avoid_: Manual panel, fader panel

**Blackout**:
Takes every Fixture's intensity to 0 until turned off, in Blind too. The active Scenes stay active.

**Default Direction**:
The Direction a Show gives moving Fixtures where no Rule sets one, and the base of a movement Effect with none. Down unless changed.

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
