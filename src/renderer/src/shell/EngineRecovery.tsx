import { CircleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DOCUMENTS, type EngineDocument, type RestoreResult } from '../../../shared/protocol';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import styles from './EngineRecovery.module.css';

// The toast after a restarted engine restored its snapshot.
const RESTARTED: Record<RestoreResult, string> = {
  restored: 'Engine restarted. Output resumed.',
  baseLook: 'Engine restarted in Base Look.',
  empty: 'Engine restarted without the open Show and Venue Patch.',
};

// Says when main restarted the engine (ADR 0011), and when the engine is
// down for good: then a banner stays, with Save as buttons that save the
// documents from main's snapshot.
export function EngineRecovery() {
  const toast = useToast();
  const [down, setDown] = useState(false);

  useEffect(() => {
    let live = true;
    void window.engineRecovery.isDown().then((isDown) => live && isDown && setDown(true));
    const offRestarted = window.engineRecovery.onRestarted((result) =>
      toast({ tone: result === 'restored' ? 'success' : 'info', message: RESTARTED[result] }),
    );
    const offDown = window.engineRecovery.onDown(() => setDown(true));
    return () => {
      live = false;
      offRestarted();
      offDown();
    };
  }, [toast]);

  if (!down) return null;

  async function saveAs(document: EngineDocument): Promise<void> {
    try {
      const path = await window.engineRecovery.saveFromSnapshot(document);
      if (path !== undefined) toast({ tone: 'success', message: `Saved ${path}` });
    } catch (error) {
      toast({
        tone: 'error',
        message: `Could not save the ${DOCUMENTS[document]}: ${(error as Error).message}`,
      });
    }
  }

  return (
    <div role="alert" className={styles.banner}>
      <CircleAlert className={styles.icon} aria-hidden />
      <span className={styles.message}>
        The engine keeps crashing. Save your work and restart LightCues.
      </span>
      <Button onClick={() => void saveAs('show')}>Save Show as…</Button>
      <Button onClick={() => void saveAs('venue')}>Save Venue Patch as…</Button>
    </div>
  );
}
