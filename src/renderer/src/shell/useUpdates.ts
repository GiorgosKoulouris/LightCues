import { useEffect, useState } from 'react';
import type { UpdateAvailable } from '../../../shared/protocol';

// A check the user asked for: running, or how it ended without a newer
// release.
export type CheckNowState = 'checking' | 'upToDate' | 'failed';

export interface Updates {
  // A newer release, from the startup check or one the user asked for.
  available: UpdateAvailable | undefined;
  // Whether the check runs on startup; undefined until main answers.
  enabled: boolean | undefined;
  setEnabled(enabled: boolean): void;
  // The last check the user asked for, unless it found a newer release.
  checkNowState: CheckNowState | undefined;
  checkNow(): void;
  // Opens the newer release's page in the default browser.
  openReleasePage(): void;
}

// The update checks' results and the startup setting. Main makes the request.
export function useUpdates(): Updates {
  const [available, setAvailable] = useState<UpdateAvailable>();
  const [enabled, setEnabledState] = useState<boolean>();
  const [checkNowState, setCheckNowState] = useState<CheckNowState>();

  useEffect(() => {
    let live = true;
    void window.updates.available().then((found) => live && found && setAvailable(found));
    void window.updates.enabled().then((on) => live && setEnabledState(on));
    return () => {
      live = false;
    };
  }, []);

  return {
    available,
    enabled,
    setEnabled(on) {
      setEnabledState(on);
      window.updates.setEnabled(on);
    },
    checkNowState,
    checkNow() {
      setCheckNowState('checking');
      void window.updates
        .checkNow()
        .catch(() => ({ state: 'failed' as const }))
        .then((outcome) => {
          if (outcome.state === 'available') {
            setAvailable(outcome.release);
            setCheckNowState(undefined);
          } else {
            setCheckNowState(outcome.state);
          }
        });
    },
    openReleasePage() {
      if (available) window.updates.openReleasePage(available.url);
    },
  };
}
