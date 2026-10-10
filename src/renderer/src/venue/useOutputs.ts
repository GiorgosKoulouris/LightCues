import { useEffect, useState } from 'react';
import type { OutputStatus } from '../../../shared/protocol';

// The engine's Outputs, kept in step through engine events. Undefined until
// the engine first answers.
export function useOutputs(): OutputStatus[] | undefined {
  const [outputs, setOutputs] = useState<OutputStatus[]>();

  useEffect(() => {
    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type === 'outputs') setOutputs(event.outputs);
    });
    window.engine.send({ type: 'listOutputs' });
    return unsubscribe;
  }, []);

  return outputs;
}
