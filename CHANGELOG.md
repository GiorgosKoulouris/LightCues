# Changelog

What changed in each LightCues release. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Copy diagnostics** in the sidebar copies the LightCues, Electron and Windows versions, the Outputs, the MIDI ports and MIDI Input, the Tempo and the log folder, to paste into a bug report. It holds no Show or Venue Patch contents.

## [0.1.1] - 2026-10-09

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

### Changed

- Scene buttons toggle: pressing an active Scene's button clears it.
- Smaller Scene buttons in Perform.
- Fixtures and grid labels keep their size on screen at any zoom, and grid labels stay clear at small scales.
- Stage views use the space they have. Spacing in the inspector and the Zone picker.
- Only the view columns scroll, never the whole window.
- The system UI font replaces Inter.

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
