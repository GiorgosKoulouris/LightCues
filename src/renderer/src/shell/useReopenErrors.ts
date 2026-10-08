import { useEffect } from 'react';
import { useToast } from '../ui/Toast';

// Shows why the last Venue Patch or Show did not reopen on launch, as error
// toasts that stay until dismissed. The engine sends them once, so a reload
// does not repeat them.
export function useReopenErrors(): void {
  const toast = useToast();

  useEffect(() => {
    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type !== 'reopenErrors') return;
      for (const message of event.errors) toast({ tone: 'error', message });
    });
    window.engine.send({ type: 'getReopenErrors' });
    return unsubscribe;
  }, [toast]);
}
