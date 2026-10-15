# Firing House Presets

Status: ready-for-human
Blocked by: 03

See spec, "Firing" and "UI".

## Work

- Engine: firing a House Preset crossfades the house state from where it is to the look over the slot's fade; Groups the look does not list stay. A slot with no look does nothing. Opening or replacing the Venue Patch goes to its Startup look; replacing the Show keeps the house state. Not in undo history.
- MIDI: a House Preset's note fires it (Go only), through the same MIDI Input as Triggers.
- Perform: a small House section with Startup plus one button per House Preset. The last fired is highlighted, during the fade too.
- Fallback Panel: the House Preset buttons, with Shift+1–8.
- CHANGELOG line.

## Acceptance

- Tests: crossfade timing, partial looks, unset slot, MIDI note fires, Show replacement keeps state, Venue Patch replacement goes to Startup, Blackout/Blind/Grand Master do not affect house output mid-fade.
- App tests: Perform and Fallback Panel buttons, Shift+N shortcuts, highlight.
- Manual check on a real Output with a house fixture.
- `npm run check` passes.

## Comments

### 2026-10-15: implemented

Done on `dev`. `npm run check` passes. Left for a human: the manual check on a real Output with a house fixture (Windows host only). Then set `resolved`.

Decisions:

- **Engine:** `createHouse` in `src/engine/house.ts` keeps one fade per House Group: from where it is, to its setting, over the slot's fade. Firing a look starts fades for the Groups it lists; the others keep theirs, mid-fade too. Intensity and colour (as red, green, blue and UV levels, like Scene crossfades) fade linearly. `lerp`, `blend`, `colourLevels` and `ColourLevels` are now exported from `scene-resolution.ts`.
- **Commands:** `fireHousePreset { id }`, `goStartupLook`, `getHouse`. Event: `house { fired }`, with `HouseFired` = `{ type: 'startup' }` or `{ type: 'preset', id }`. It is sent from the start of the fade, so the highlight shows during it. A House Preset not in the Show, or with no look in this Venue Patch, does nothing and sends nothing.
- **Startup button:** fades over a fixed 2 s (`STARTUP_FADE_S`). It goes back to the launch state: Groups the Startup look does not list go to full white, not "stay". Without that, Startup would do nothing in a venue with no Startup look. Recorded in CONTEXT.md under Startup look. Opening or replacing the Venue Patch jumps to it with no fade.
- **MIDI:** a note goes to its Trigger first, then to its House Preset. Validation already keeps them apart. Note-off does nothing for House Presets.
- **Snapshot:** the house state joins the engine snapshot (`house: { look, fired }`), as issue 01 asked. A restart restores it with the fades done. The Base Look fallback sends the House Lights to the Startup look. ADR 0011 updated.
- **Perform:** a House section above the Layers, shown only while the Venue Patch has House Lights. Startup, then one button per House Preset with its key (⇧1–⇧8). "No House Presets: add them in the Show view." when there are none.
- **Fallback Panel:** the House Preset buttons after the Scene buttons, highlighted like Perform. No Startup button: the Shift keys stop at 8, and Startup is a Perform control. The buttons show even without House Lights, as the strip has no Venue Patch; they then do nothing.
- **Shift+1–8** go by the physical key (`code` `Digit1`–`Digit8`), as Shift changes the character typed. On a layout that types digits with Shift (AZERTY), Shift+1 now fires House Preset 1 rather than Scene button 1. `KeyPress` gained `code` and `shiftKey`; `AppKeyPress` folded into it.
- **README:** House Presets in the Triggers step, the House section in Perform, Shift+1–8 in the Fallback Panel keys.
- **Tests:** `house.test.ts` (timing, colour, mid-fade, unset slot, Startup, preview, snapshot), `outputs.test.ts` (fade on the Output; Blackout, Grand Master, Freeze and Blind mid-fade; Show vs Venue Patch replacement; undo history), `midi-triggers.test.ts`, `snapshot.test.ts`, and the Perform, Fallback Panel, shortcut and App tests. No e2e test, as in 01.

