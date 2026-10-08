import { useEffect, useState } from 'react';
import type { FixtureLight } from '../../../shared/protocol';

// The Previews mounted now. The engine has one preview stream, so the last
// to unmount stops it.
let mounted = 0;

// How each Fixture looks now, by Fixture id, kept in step through engine
// events. The engine sends them only while a preview is mounted.
export function usePreview(): Record<string, FixtureLight> {
  const [lights, setLights] = useState<Record<string, FixtureLight>>({});

  useEffect(() => {
    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type === 'preview') setLights(event.lights);
    });
    // Sent by each, so each gets the current lights at once.
    mounted++;
    window.engine.send({ type: 'startPreview' });
    return () => {
      mounted--;
      if (mounted === 0) window.engine.send({ type: 'stopPreview' });
      unsubscribe();
    };
  }, []);

  return lights;
}
