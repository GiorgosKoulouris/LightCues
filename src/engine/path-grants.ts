import { resolve } from 'node:path';

// Why the engine refuses a path the user did not pick.
export const NOT_CHOSEN = 'the file was not chosen in a file dialog';

// Paths the engine may read and write: those main granted after the user
// picked them in a native dialog, plus the files the engine reopens itself.
// Paths match after resolving `..` and ignoring case, as on Windows. Grants
// last for the engine's lifetime.
export function createPathGrants() {
  const granted = new Set<string>();
  const key = (path: string) => resolve(path).toLowerCase();
  return {
    grant: (path: string) => void granted.add(key(path)),
    has: (path: string) => granted.has(key(path)),
  };
}
