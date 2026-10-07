import { useEffect, useState } from 'react';
import type { EngineEvent } from '../../../shared/protocol';

export type PlaybackState = Omit<Extract<EngineEvent, { type: 'playback' }>, 'type'>;

// The engine's active Scenes and mode, kept in step through engine events.
export function usePlayback(): PlaybackState | undefined {
  const [playback, setPlayback] = useState<PlaybackState>();

  useEffect(() => {
    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type === 'playback') setPlayback({ active: event.active, mode: event.mode });
    });
    window.engine.send({ type: 'getPlayback' });
    return unsubscribe;
  }, []);

  return playback;
}
