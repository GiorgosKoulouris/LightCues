import { dirname } from 'node:path';

// Where the last files are kept between runs, on this machine.
export interface RecentFilesStorage {
  // The saved JSON, or undefined when nothing is saved yet.
  read(): string | undefined;
  write(json: string): void;
}

// One document's last file, reopened on the next launch, and the folder its
// file dialogs start in.
export interface RecentFile {
  file(): string | undefined;
  // The folder of the last file opened or saved. Kept after New or a failed
  // reopen.
  folder(): string | undefined;
  // After the document was opened from or saved to `path`, or replaced by New
  // or a failed reopen (undefined).
  set(path: string | undefined): void;
}

// The documents that reopen on launch.
export type RecentKind = 'venue' | 'show';

interface Entry {
  file?: string;
  folder?: string;
}

type Saved = Partial<Record<RecentKind, Entry>>;

// The last Venue Patch and Show files.
export function createRecentFiles(storage: RecentFilesStorage | undefined) {
  const saved = read(storage);

  return {
    of(kind: RecentKind): RecentFile {
      return {
        file: () => saved[kind]?.file,
        folder: () => saved[kind]?.folder,
        set(path) {
          const { folder } = saved[kind] ?? {};
          const entry: Entry =
            path === undefined
              ? { ...(folder === undefined ? {} : { folder }) }
              : { file: path, folder: dirname(path) };
          if (JSON.stringify(entry) === JSON.stringify(saved[kind] ?? {})) return;
          saved[kind] = entry;
          storage?.write(JSON.stringify(saved));
        },
      };
    },
  };
}

function read(storage: RecentFilesStorage | undefined): Saved {
  try {
    const json = JSON.parse(storage?.read() ?? '{}') as Saved | null;
    const saved: Saved = {};
    for (const kind of ['venue', 'show'] as const) {
      const { file, folder } = json?.[kind] ?? {};
      saved[kind] = {
        ...(typeof file === 'string' ? { file } : {}),
        ...(typeof folder === 'string' ? { folder } : {}),
      };
    }
    return saved;
  } catch (error) {
    console.error('Saved recent files are unreadable; starting without them.', error);
    return {};
  }
}
