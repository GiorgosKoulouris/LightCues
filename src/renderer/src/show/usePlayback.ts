import { useEffect, useState } from 'react';
import type { EngineEvent } from '../../../shared/protocol';

export type PlaybackState = Omit<Extract<EngineEvent, { type: 'playback' }>, 'type'>;

// The engine's active Scenes, mode, Grand Master, Blackout, Freeze and Focus Check,
// kept in step through engine events.
export function usePlayback(): PlaybackState | undefined {
  const [playback, setPlayback] = useState<PlaybackState>();

  useEffect(() => {
    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type !== 'playback') return;
      const { active, mode, grandMaster, blackout, freeze, focusCheck } = event;
      setPlayback({
        active,
        mode,
        grandMaster,
        blackout,
        freeze,
        ...(focusCheck === undefined ? {} : { focusCheck }),
      });
    });
    window.engine.send({ type: 'getPlayback' });
    return unsubscribe;
  }, []);

  return playback;
}
