import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LibraryStorage } from './engine';
import type { ShowFiles } from './show-session';
import type { VenueFiles } from './venue-session';

// Keeps saved JSON in one file. Writes go to a temporary file first, so a
// crash mid-write never leaves a half-written file.
export function fileStorage(path: string): LibraryStorage {
  return {
    read: () => (existsSync(path) ? readFileSync(path, 'utf8') : undefined),
    write: (json) => writeSafely(path, json),
    setAside() {
      if (existsSync(path)) renameSync(path, `${path}.unreadable-${Date.now()}`);
    },
  };
}

// .lcvenue files wherever the user chose to keep them.
export const diskVenueFiles: VenueFiles = {
  read: (path) => readFileSync(path, 'utf8'),
  write: writeSafely,
};

// .lcshow files wherever the user chose to keep them.
export const diskShowFiles: ShowFiles = diskVenueFiles;

function writeSafely(path: string, json: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, json);
  renameSync(`${path}.tmp`, path);
}
