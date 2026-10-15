import { useEffect, useState } from 'react';
import type { HouseFired } from '../../../shared/protocol';

// What the House Lights went to last, kept in step through engine events.
export function useHouse(): HouseFired | undefined {
  const [fired, setFired] = useState<HouseFired>();

  useEffect(() => {
    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type === 'house') setFired(event.fired);
    });
    window.engine.send({ type: 'getHouse' });
    return unsubscribe;
  }, []);

  return fired;
}
