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

// The folder file dialogs start in, for files that are not reopened.
export interface RecentFolder {
  folder(): string | undefined;
  // After a file in the folder was read or written.
  set(path: string): void;
}

// The documents that reopen on launch.
export type RecentKind = 'venue' | 'show';

interface Entry {
  file?: string;
  folder?: string;
}

// The Profile Library is kept in userData; only the folder of the last
// library file exported or imported is remembered.
type Saved = Partial<Record<RecentKind | 'library', Entry>>;

// The last Venue Patch and Show files, and the last library folder.
export function createRecentFiles(storage: RecentFilesStorage | undefined) {
  const saved = read(storage);

  function write(kind: keyof Saved, entry: Entry): void {
    if (JSON.stringify(entry) === JSON.stringify(saved[kind] ?? {})) return;
    saved[kind] = entry;
    storage?.write(JSON.stringify(saved));
  }

  return {
    library: {
      folder: () => saved.library?.folder,
      set: (path) => write('library', { folder: dirname(path) }),
    } satisfies RecentFolder,

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
          write(kind, entry);
        },
      };
    },
  };
}

function read(storage: RecentFilesStorage | undefined): Saved {
  try {
    const json = JSON.parse(storage?.read() ?? '{}') as Saved | null;
    const saved: Saved = {};
    for (const kind of ['venue', 'show', 'library'] as const) {
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
