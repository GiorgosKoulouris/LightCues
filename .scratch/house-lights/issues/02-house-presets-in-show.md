# House Preset slots in the Show

Status: resolved

See spec, "Where things live" and "Firing".

## Work

- `src/shared/show.ts`: `housePresets?: { id, name, fade, note?: MidiNote }[]`, at most 8, in order. Edits to add, rename, reorder, remove, set fade and note. Validation rejects a note used by a Scene Trigger or another House Preset, and the reverse when adding a Trigger.
- `src/engine/show-file.ts`: optional field, older `.lcshow` files still read.
- Show editor: a House Presets list next to Triggers: name, fade, MIDI note (with the same learn/entry as Triggers, if there is one).
- Undoable like other Show edits.
- CHANGELOG line.

## Acceptance

- Tests: edits, the 8 cap, note clashes both ways, file round-trip and reading an old file.
- App test: add, rename and remove a House Preset.
- `npm run check` passes.

## Comments

### 2026-10-15: implemented

Done on `dev`. `npm run check` passes.

Decisions:

- **Model:** `Show.housePresets?: HousePreset[]` (`id`, `name`, `fade` in seconds, optional `note`), read through `showHousePresets`. `findHousePreset(show, id)` and `findHousePresetOn(show, note)` sit next to `findTrigger`; issue 04 can use the second for firing. Removing the last House Preset drops the field, like `panelScenes`.
- **Edits:** `putHousePreset` (add at the end, or replace by id: rename, fade, note, clear note), `moveHousePreset { id, to }` and `removeHousePreset`. All undoable; quick edits to the same House Preset merge into one undo step.
- **Validation:** fade 0 or more, MIDI ranges, non-empty id and name, unique ids, at most 8. One message per clash: `House Preset "Dim": note 1/60 is also a Trigger`, the same whether the Trigger or the House Preset came second. Two House Presets on a note: `House Preset note 1/60 is used twice`.
- **`.lcshow` version 5.** Same reasoning as `.lcvenue` v3: v1–v4 files still open, and an older app refuses a v5 file instead of dropping its House Presets. `examples/demo.lcshow` regenerated.
- **Show editor:** a House Presets section under the Triggers, in the Triggers tab. Each row: drag handle, name, fade (s), and the note (channel and note fields, Learn, clear) or "No note" with Learn and "Add a note", which picks the first free note from C4 on channel 1. New House Presets fade over 2 s. Removing is instant, with a toast; Undo brings it back.
- **New Trigger** warns, and disables Map, when the note is a House Preset's.
- **MIDI learn** moved into `useMidiLearn` in `useMidiInput.ts`, shared by Triggers and House Presets. The engine command is still `learnTrigger`. Learning a Trigger and a House Preset at the same time gives both the same note; not guarded.
- **Not shown yet:** the Shift+1–8 keys. They belong to issue 04, so the panel does not mention them until they work.
- **README:** no change yet. House Presets do nothing until issues 03 and 04, so the README step fits better there.
- **App test:** `ShowView.test.tsx` covers adding, renaming and removing a House Preset, plus fade, note entry, learn, clear, reorder and the cap. Engine tests cover undo; file tests cover v5 round-trip and reading v4.

