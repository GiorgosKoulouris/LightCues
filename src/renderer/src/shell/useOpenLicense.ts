import type { LicenseFile } from '../../../shared/protocol';
import { useToast } from '../ui/Toast';

const NAMES: Record<LicenseFile, string> = {
  license: 'the LightCues license',
  thirdPartyNotices: 'the third-party notices',
};

// Opens a license file that ships with the app. Says so when main could not.
export function useOpenLicense(): (file: LicenseFile) => Promise<void> {
  const toast = useToast();
  return async (file) => {
    const opened = await window.licenses.open(file).catch(() => false);
    if (!opened) toast({ tone: 'error', message: `Could not open ${NAMES[file]}.` });
  };
}
