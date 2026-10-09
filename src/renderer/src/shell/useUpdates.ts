import { useEffect, useState } from 'react';
import type { UpdateAvailable } from '../../../shared/protocol';

export interface Updates {
  // A newer release, while the check is on.
  available: UpdateAvailable | undefined;
  // Whether the check is on; undefined until main answers.
  enabled: boolean | undefined;
  setEnabled(enabled: boolean): void;
  // Opens the newer release's page in the default browser.
  openReleasePage(): void;
}

// The launch update check's result and its setting. Main makes the request.
export function useUpdates(): Updates {
  const [available, setAvailable] = useState<UpdateAvailable>();
  const [enabled, setEnabledState] = useState<boolean>();

  useEffect(() => {
    let live = true;
    void window.updates.available().then((found) => live && setAvailable(found));
    void window.updates.enabled().then((on) => live && setEnabledState(on));
    return () => {
      live = false;
    };
  }, []);

  return {
    available: enabled === false ? undefined : available,
    enabled,
    setEnabled(on) {
      setEnabledState(on);
      window.updates.setEnabled(on);
    },
    openReleasePage() {
      if (available) window.updates.openReleasePage(available.url);
    },
  };
}
