import { useEffect, useState } from 'react';
import { DMX_CHANNELS } from '../../../shared/venue-patch';

const SILENT: number[] = new Array<number>(DMX_CHANNELS).fill(0);

// The DMX values last sent for `universe`, channel 1 first, kept in step
// through engine events. Zeros until the first frame. The engine monitors one
// Universe at a time, so only one of these is mounted.
export function useDmxFrame(universe: number): number[] {
  const [frame, setFrame] = useState({ universe, values: SILENT });

  useEffect(() => {
    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type === 'dmxFrame' && event.universe === universe)
        setFrame({ universe, values: event.values });
    });
    window.engine.send({ type: 'monitorUniverse', universe });
    return () => {
      window.engine.send({ type: 'stopMonitor' });
      unsubscribe();
    };
  }, [universe]);

  // Another Universe's frame is not shown while the new one comes.
  return frame.universe === universe ? frame.values : SILENT;
}
