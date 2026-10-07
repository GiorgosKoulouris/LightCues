import { useEffect, useState } from 'react';
import type { FixtureLight } from '../../../shared/protocol';

// How each Fixture looks now, by Fixture id, kept in step through engine
// events. The engine sends them only while a preview is mounted.
export function usePreview(): Record<string, FixtureLight> {
  const [lights, setLights] = useState<Record<string, FixtureLight>>({});

  useEffect(() => {
    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type === 'preview') setLights(event.lights);
    });
    window.engine.send({ type: 'startPreview' });
    return () => {
      window.engine.send({ type: 'stopPreview' });
      unsubscribe();
    };
  }, []);

  return lights;
}
