import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { diskLibraryBackups, diskVenueFiles } from './file-storage';

describe('diskLibraryBackups', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lightcues-backups-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  // Backups in `dir/backups`, one second apart from 2026-10-09 14:30:00 local time.
  function backups() {
    let second = 0;
    const folder = join(dir, 'backups');
    const store = diskLibraryBackups(folder, () => new Date(2026, 9, 9, 14, 30, second++));
    return { store, folder };
  }

  it('writes the JSON to a timestamped file, creating the folder', () => {
    const { store, folder } = backups();

    const path = store.save('{"version":2}');

    expect(path).toBe(join(folder, 'profile-library-2026-10-09T14-30-00.json'));
    expect(readFileSync(path, 'utf8')).toBe('{"version":2}');
  });

  it('keeps the newest 10 backups', () => {
    const { store, folder } = backups();
    for (let i = 0; i < 11; i++) store.save(`{"n":${i}}`);

    const names = readdirSync(folder).sort();
    expect(names).toHaveLength(10);
    expect(names[0]).toBe('profile-library-2026-10-09T14-30-01.json');
    expect(readFileSync(join(folder, names[9]!), 'utf8')).toBe('{"n":10}');
  });

  it('never overwrites a backup made in the same second', () => {
    const folder = join(dir, 'backups');
    const store = diskLibraryBackups(folder, () => new Date(2026, 9, 9, 14, 30, 5));

    const first = store.save('{"n":1}');
    const second = store.save('{"n":2}');

    expect(first).toBe(join(folder, 'profile-library-2026-10-09T14-30-05.json'));
    expect(second).toBe(join(folder, 'profile-library-2026-10-09T14-30-06.json'));
    expect(readFileSync(first, 'utf8')).toBe('{"n":1}');
  });

  it('leaves other files in the folder alone', () => {
    const { store, folder } = backups();
    store.save('{}');
    writeFileSync(join(folder, 'notes.txt'), '');
    for (let i = 0; i < 11; i++) store.save('{}');

    expect(readdirSync(folder)).toContain('notes.txt');
  });

  it('throws when the backup cannot be written', () => {
    const blocker = join(dir, 'backups');
    writeFileSync(blocker, '');

    expect(() => diskLibraryBackups(blocker).save('{}')).toThrow();
  });
});

describe('diskVenueFiles', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lightcues-files-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('reads a file', () => {
    const path = join(dir, 'Club.lcvenue');
    writeFileSync(path, '{"version":1}');

    expect(diskVenueFiles.read(path)).toBe('{"version":1}');
  });

  it('rejects a file over 32 MB without reading it', () => {
    const path = join(dir, 'Huge.lcshow');
    writeFileSync(path, '');
    // Sparse: no 32 MB is written.
    truncateSync(path, 32 * 1024 * 1024 + 1);

    expect(() => diskVenueFiles.read(path)).toThrow('File is too large (over 32 MB)');
  });

  it('reports a missing file', () => {
    expect(() => diskVenueFiles.read(join(dir, 'Gone.lcvenue'))).toThrow('File not found');
  });
});
