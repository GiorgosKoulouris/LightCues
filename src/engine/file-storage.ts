import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { LibraryBackups, LibraryFiles, LibraryStorage } from './engine';
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
  read(path) {
    if (!existsSync(path)) throw new Error('File not found');
    return readFileSync(path, 'utf8');
  },
  write: writeSafely,
};

// .lcshow files wherever the user chose to keep them.
export const diskShowFiles: ShowFiles = diskVenueFiles;

// .lclibrary files, and library JSON to import, wherever the user keeps them.
export const diskLibraryFiles: LibraryFiles = diskVenueFiles;

const BACKUPS_KEPT = 10;
const BACKUP_PREFIX = 'profile-library-';
const BACKUP_NAME = new RegExp(
  `^${BACKUP_PREFIX}\\d{4}-\\d\\d-\\d\\dT\\d\\d-\\d\\d-\\d\\d\\.json$`,
);

// Library backups in `folder`, named by local time to the second. A name
// already taken moves on a second, so no backup is overwritten. After each
// backup, all but the newest BACKUPS_KEPT are deleted.
export function diskLibraryBackups(folder: string, now = () => new Date()): LibraryBackups {
  const backupPath = (date: Date) => join(folder, `${BACKUP_PREFIX}${timestamp(date)}.json`);
  return {
    save(json) {
      const date = now();
      while (existsSync(backupPath(date))) date.setSeconds(date.getSeconds() + 1);
      const path = backupPath(date);
      writeSafely(path, json);
      prune();
      return path;
    },
  };

  // Best effort: the backup is already written, so a failure here must not
  // stop the import.
  function prune(): void {
    try {
      const backups = readdirSync(folder)
        .filter((name) => BACKUP_NAME.test(name))
        .sort();
      for (const name of backups.slice(0, -BACKUPS_KEPT)) rmSync(join(folder, name));
    } catch {
      // Old backups stay until the next import.
    }
  }
}

// e.g. 2026-10-09T14-30-05: sortable and safe in a file name.
function timestamp(d: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}` +
    `T${two(d.getHours())}-${two(d.getMinutes())}-${two(d.getSeconds())}`
  );
}

function writeSafely(path: string, json: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, json);
  renameSync(`${path}.tmp`, path);
}
