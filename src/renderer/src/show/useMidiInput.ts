import { useEffect, useState } from 'react';
import type { MidiInputStatus } from '../../../shared/protocol';

// The engine's MIDI input status, kept in step through engine events.
export function useMidiInput(): MidiInputStatus | undefined {
  const [status, setStatus] = useState<MidiInputStatus>();

  useEffect(() => {
    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type === 'midiInput') setStatus(event.status);
    });
    window.engine.send({ type: 'listMidiInputs' });
    return unsubscribe;
  }, []);

  return status;
}

// A warning for a selected input that is not listening, or undefined.
export function midiWarning(status: MidiInputStatus | undefined): string | undefined {
  if (status?.state === 'lost') {
    return `MIDI input "${status.selected}" is lost. Holding the current look until it returns.`;
  }
  if (status?.state === 'failed') {
    return `MIDI input "${status.selected}" did not open: ${status.error}. Retrying.`;
  }
  return undefined;
}
