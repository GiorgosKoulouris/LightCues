import { findHousePresetOn, findTrigger, type MidiNote, type Show } from '../../../shared/show';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Where a typed-in note starts: C4 on channel 1.
const FIRST_NOTE: MidiNote = { channel: 1, note: 60 };

// A note and its channel, as named in labels: "C4 on channel 1".
export function noteLabel({ channel, note }: MidiNote): string {
  return `${noteName(note)} on channel ${channel}`;
}

// Note 60 is C4.
export function noteName(note: number): string {
  if (!Number.isInteger(note) || note < 0 || note > 127) return '';
  return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}

// The first note on channel 1 from C4 up that no Trigger or House Preset
// uses, or C4 when every one is.
export function freeNote(show: Show): MidiNote {
  const used = (note: MidiNote) => findTrigger(show, note) ?? findHousePresetOn(show, note);
  for (let note = FIRST_NOTE.note; note <= 127; note++) {
    if (!used({ ...FIRST_NOTE, note })) return { ...FIRST_NOTE, note };
  }
  return FIRST_NOTE;
}
