import type { EngineEvent, MidiInputStatus } from '../shared/protocol';
import type { MidiNote } from '../shared/show';

// How often MIDI input ports are listed to find a lost port and its return.
const SCAN_INTERVAL_MS = 1000;
// The MIDI Clock tick. Start, Continue and Stop are ignored.
const CLOCK_TICK = 0xf8;

interface MidiConnection {
  close(): void;
}

// The machine's MIDI input ports, by name. Structural, so the engine is
// testable without hardware. Both throw on failure.
export interface MidiPorts {
  list(): string[];
  // `onMessage` gets each message's bytes: status first.
  open(name: string, onMessage: (message: number[]) => void): MidiConnection;
}

// A note-on (`on`) or note-off message.
export interface NoteMessage extends MidiNote {
  on: boolean;
}

// Where the selected input's name is kept between runs, on this machine.
export interface MidiInputStorage {
  // The saved JSON, or undefined when nothing is saved yet.
  read(): string | undefined;
  write(json: string): void;
}

interface MidiInputOptions {
  ports: MidiPorts;
  storage?: MidiInputStorage;
  emit: (event: EngineEvent) => void;
  onNote: (message: NoteMessage) => void;
  // Each MIDI Clock tick, 24 per beat.
  onClock: () => void;
}

// Listens to the selected MIDI input port. A port that disappears is lost and
// reopened when a scan finds it again. The selection is kept between runs.
export function createMidiInput({ ports, storage, emit, onNote, onClock }: MidiInputOptions) {
  let listed: string[] = [];
  let selected = savedSelection(storage);
  let connection: MidiConnection | undefined;
  let error: string | undefined;
  // Logged once, not on every scan, e.g. on a machine without MIDI.
  let listFailed = false;

  function status(): MidiInputStatus {
    const base = { ports: listed, ...(selected === undefined ? {} : { selected }) };
    if (selected === undefined) return { ...base, state: 'none' };
    if (connection) return { ...base, state: 'connected' };
    if (error !== undefined) return { ...base, state: 'failed', error };
    return { ...base, state: 'lost' };
  }

  let lastEmitted = '';
  function emitStatus({ always }: { always: boolean }): void {
    const current = status();
    const json = JSON.stringify(current);
    if (json === lastEmitted && !always) return;
    lastEmitted = json;
    emit({ type: 'midiInput', status: current });
  }

  function disconnect(): void {
    connection?.close();
    connection = undefined;
    error = undefined;
  }

  // Closes the selected port if it is gone, and opens it if it is listed.
  function reconcile(): void {
    if (selected === undefined || !listed.includes(selected)) disconnect();
    else if (!connection) connect(selected);
    emitStatus({ always: false });
  }

  function connect(name: string): void {
    try {
      connection = ports.open(name, (message) => {
        if (message[0] === CLOCK_TICK) return onClock();
        const note = parseNote(message);
        if (note) onNote(note);
      });
      error = undefined;
    } catch (e) {
      error = (e as Error).message;
    }
  }

  function scan(): void {
    try {
      listed = ports.list();
      listFailed = false;
    } catch (e) {
      if (!listFailed) console.error('Could not list MIDI inputs.', e);
      listFailed = true;
      listed = [];
    }
    reconcile();
  }

  scan();
  setInterval(scan, SCAN_INTERVAL_MS);

  return {
    select(name: string | undefined): void {
      if (name === selected) return emitStatus({ always: false });
      disconnect();
      selected = name;
      storage?.write(JSON.stringify(name === undefined ? {} : { selected: name }));
      scan();
    },
    emitStatus: () => emitStatus({ always: true }),
  };
}

// An unreadable file selects nothing; the next selection overwrites it.
function savedSelection(storage: MidiInputStorage | undefined): string | undefined {
  try {
    const { selected } = JSON.parse(storage?.read() ?? '{}') as { selected?: unknown };
    return typeof selected === 'string' ? selected : undefined;
  } catch (error) {
    console.error('Saved MIDI input is unreadable; starting without one.', error);
    return undefined;
  }
}

// A note-on with velocity 0 is a note-off. Other messages are not notes.
function parseNote([status = 0, note = 0, velocity = 0]: number[]): NoteMessage | undefined {
  const kind = status & 0xf0;
  if (kind !== 0x80 && kind !== 0x90) return undefined;
  return { channel: (status & 0x0f) + 1, note, on: kind === 0x90 && velocity > 0 };
}
