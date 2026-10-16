# Changelog

What changed in each LightCues release. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- House Lights: patch the venue's own lights, such as the bar, in House Groups in the Venue Patch's new **House** tab. They start at full white, or at the Startup look you set, and Scenes, Blackout, the Grand Master, Freeze and Blind never reach them.
- House Presets: up to 8 named slots per Show for the House Lights, such as Dim and Up, each with a fade and an optional MIDI note. Add them under the Triggers in the **Triggers** tab. A note cannot be both a Trigger and a House Preset's.
- House looks: in the Venue Patch's **House** tab, set what each House Preset of the Show does in this venue, with the rig showing it as you edit. A House Preset with no look is marked "Not set up in this venue". Looks for House Presets the Show lacks are kept, and can be removed.
- Fire House Presets from their MIDI note, from the new House section in Perform, or from the Fallback Panel with Shift+1–8. The House Lights fade to the look over the House Preset's fade; the last one fired is highlighted. **Startup** in Perform fades back to the Startup look. Opening a Venue Patch goes to its Startup look; opening a Show keeps the House Lights as they are.
- Strobe: a Rule can strobe the Fixtures it targets, Slow, Medium or Fast, or once per 1, 1/2 or 1/4 beat of the Tempo. Off stops strobe from earlier Rules and lower Layers. The preview flashes strobing Fixtures, and the Fixture inspector lists the Scenes that strobe a Fixture with no strobe channel, or whose strobe rate is unknown.
- Movement Effect **None**: stops the movement Effect of lower Layers and earlier Rules, holding the aim still, faded in over the Scene's fade-in.
- Effects can run in cycles of 1/4 and 1/2 beat.
- Intensity Effects: Pulse, Ramp up, Ramp down, Square and Chase scale the intensity of a Rule's Fixtures, even intensity from other Layers. Chase lights one Spread position at a time. **None** stops the intensity Effect of lower Layers and earlier Rules.
- Colour Effects: a Rule can step or fade through 2 to 4 colours, or run a Rainbow, in place of its colour. Spread offsets each Fixture, so Alternate with two colours gives odd and even. Fixtures with a colour wheel snap to its nearest colour. **None** stops the colour Effect of lower Layers and earlier Rules, back to the colour under it.

### Changed

- Venue Patches and Shows saved by this version do not open in older versions of LightCues, as they can hold House Lights, House Presets, strobe and the new Effect settings. Older files still open.

## [0.1.1] - 2026-10-12

### Added

- Try LightCues without hardware: **Open example** opens a demo Venue Patch on the Virtual Output and an 8-Scene Show.
- Virtual Output: an Output with no hardware, for trying a Show.
- Channel monitor in the Venue Patch view: the 512 values an Output gets for one Universe, in Blind too.
- Import and export the Profile Library as a `.lclibrary` file. Importing replaces the library and keeps a backup of the old one.
- Update check: LightCues tells you when a newer release is out, with a link to its page. A "Check for updates" button checks at once. Nothing is downloaded.
- Recovery: if part of LightCues stops unexpectedly, it restarts and restores the open Venue Patch, Show and current look. If it keeps stopping, you can still save your work.
- Log file in `%APPDATA%\LightCues\logs\`, one per day, kept 14 days. Attach it to a bug report.
- Import multi-cell Open Fixture Library Profiles (matrix channels).
- A toggle hides Fixture labels in the stage views.
- App icon.
- **Copy diagnostics** in the sidebar copies the LightCues, Electron and Windows versions, the Outputs, the MIDI ports and MIDI Input, the Tempo and the log folder, to paste into a bug report. It holds no Show or Venue Patch contents.
- `THIRD_PARTY_NOTICES.txt` in the install folder's `resources` lists the open-source software and fixture data LightCues includes, with their licenses.
- **Licenses** in the sidebar opens the LightCues license and the third-party notices.

### Changed

- Scene buttons toggle: pressing an active Scene's button clears it.
- Smaller Scene buttons in Perform.
- Fixtures and grid labels keep their size on screen at any zoom, and grid labels stay clear at small scales.
- Stage views use the space they have. Spacing in the inspector and the Zone picker.
- Only the view columns scroll, never the whole window.
- The system UI font replaces Inter.
- The sidebar's lower buttons line up with the views, and **Check for updates** shows its name.

### Fixed

- Importing a Profile Library skips a Profile whose pan, tilt, intensity or strobe span is not two finite numbers. Before, its Fixtures could snap to the end of their pan or tilt, or go dark.

### Security

- The app opens no new windows and never navigates away from its own page.
- LightCues reads and writes only files you chose.
- Size limits on GDTF, Venue Patch, Show and Profile Library files.
- A malformed command can no longer stop LightCues.
- Electron updated to 44.7.0.

## [0.1.0] - 2026-10-08

The first release.

### Added

- Fixture Profiles: import from Open Fixture Library and GDTF, or make them by hand in the Profile editor. Multi-cell GDTF fixtures are flattened.
- Profile Library for all your Fixture Profiles.
- Venue Patch: the rig for one venue, with each Fixture's Profile, Universe, address, stage position and Mounting, edited on a top-down stage plan.
- Shows, venue-independent: Scenes built from Rules that target Zones and Roles, combined when several are active.
- A Default Colour per Show for Fixtures no Rule sets.
- Directions for moving Fixtures, computed from each Fixture's position and Mounting. Unreachable aims are approximated and reported in the Venue Check.
- Focus Check: send every moving Fixture to one Direction on the real rig to correct placement and Mounting.
- Run movement Effects (Circle, Pan sweep, Tilt sweep, Ballyhoo) to the Tempo, and hold them with Freeze.
- Tempo from MIDI Clock, or Tap Tempo.
- MIDI Triggers that activate Scenes from your DAW.
- Preview from above and from the front, with beam lines, in Monitor and Blind.
- Fallback Panel: Blackout, Base Look, Grand Master, Tap Tempo, Freeze and Scene buttons, each with a keyboard shortcut.
- Perform view for the show.
- Undo and Redo for Show and Venue Patch edits.
- DMX output through an Enttec DMX USB Pro.
- Reopens the last Venue Patch and Show on launch. File dialogs start in the last folder used.
- Windows installer.
