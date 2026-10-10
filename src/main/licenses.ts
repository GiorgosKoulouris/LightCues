import { join } from 'node:path';
import type { LicenseFile } from '../shared/protocol';

// The license files electron-builder puts in the resources folder:
// `extraResources` copies LICENSE.txt, the afterPack hook writes
// THIRD_PARTY_NOTICES.txt.
const LICENSE_FILES: Record<LicenseFile, string> = {
  license: 'LICENSE.txt',
  thirdPartyNotices: 'THIRD_PARTY_NOTICES.txt',
};

// The path of the license file the renderer names, or undefined for any other
// value. The renderer never sends a path. Inherited keys such as `toString`
// do not count.
export function licensePath(file: unknown, resources: string): string | undefined {
  if (typeof file !== 'string' || !Object.hasOwn(LICENSE_FILES, file)) return undefined;
  return join(resources, LICENSE_FILES[file as LicenseFile]);
}
