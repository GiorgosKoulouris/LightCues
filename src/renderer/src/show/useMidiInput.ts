import { useEffect, useRef, useState } from 'react';
import type { MidiInputStatus } from '../../../shared/protocol';
import type { MidiNote } from '../../../shared/show';

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

// MIDI learn: while `learning`, the next note played calls `onLearned`
// instead of firing what it is mapped to. `onLearned` may be a new function on each
// render.
export function useMidiLearn(learning: boolean, onLearned: (note: MidiNote) => void): void {
  const latest = useRef(onLearned);
  useEffect(() => {
    latest.current = onLearned;
  });

  useEffect(() => {
    if (!learning) return;
    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type === 'triggerLearned') latest.current(event.note);
    });
    window.engine.send({ type: 'learnTrigger' });
    return () => {
      unsubscribe();
      window.engine.send({ type: 'cancelLearn' });
    };
  }, [learning]);
}
