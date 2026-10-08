import { useEffect, useState } from 'react';
import type { EngineEvent } from '../../../shared/protocol';

export type TempoState = Omit<Extract<EngineEvent, { type: 'tempo' }>, 'type'>;

// The engine's Tempo and where it comes from, kept in step through engine
// events.
export function useTempo(): TempoState | undefined {
  const [tempo, setTempo] = useState<TempoState>();

  useEffect(() => {
    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type === 'tempo') setTempo({ bpm: event.bpm, source: event.source });
    });
    window.engine.send({ type: 'getTempo' });
    return unsubscribe;
  }, []);

  return tempo;
}
