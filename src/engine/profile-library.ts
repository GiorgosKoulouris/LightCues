import { ROLES, type FixtureProfile } from '../shared/fixture-profile';
import type { SkippedProfile } from '../shared/protocol';
import { importGdtfFixture } from './gdtf-import';
import type { FixtureImport } from './import-report';
import { importOflFixture } from './ofl-import';
import { validateProfile } from './validate-profile';

// The app-level collection of Fixture Profiles available to any Venue Patch.
export interface ProfileLibrary {
  // Adds the fixture, replacing any Profile with the same id. A hand-edited
  // Profile is only replaced with `overwrite`; otherwise nothing is saved and
  // the result is a `conflict`.
  importOfl(json: unknown, manufacturer: string, options?: { overwrite?: boolean }): ImportResult;
  // A `.gdtf` file's bytes, imported by the same rules as `importOfl`.
  importGdtf(bytes: Uint8Array, options?: { overwrite?: boolean }): ImportResult;
  // Saves a Profile made or edited by hand. An edit passes the id it
  // `replaces`, so the id may change; a new Profile may not take an existing
  // id. Returns validation errors; an empty list means it was saved.
  put(profile: FixtureProfile, options?: { replaces?: string }): string[];
  remove(id: string): void;
  get(id: string): FixtureProfile | undefined;
  isHandEdited(id: string): boolean;
  // Sorted by manufacturer, then model.
  list(): FixtureProfile[];
  // Versioned JSON, readable by `createProfileLibrary`.
  save(): string;
}

// The Profiles a library holds and which of them were made or edited by hand.
export interface LibraryContents {
  profiles: FixtureProfile[];
  handEdited: string[];
}

// The outcome of reading a library file picked by the user. A readable file
// may still have skipped Profiles; a rejected one changes nothing.
export type LibraryFileRead =
  | { status: 'rejected'; reason: string }
  | ({ status: 'readable'; skipped: SkippedProfile[] } & LibraryContents);

export interface ImportResult extends FixtureImport {
  status: 'imported' | 'conflict';
}

const VERSION = 2;
// Still readable: version 1 had no hand-edited ids.
const VERSION_1 = 1;

interface SavedLibrary {
  version: number;
  profiles: FixtureProfile[];
  // Ids of Profiles made or edited by hand. Absent in version 1.
  handEdited?: string[];
}

// Restores saved JSON, or contents kept by `readLibraryFile`.
export function createProfileLibrary(saved?: string | LibraryContents): ProfileLibrary {
  const profiles = new Map<string, FixtureProfile>();
  const handEdited = new Set<string>();
  if (saved) {
    const library = typeof saved === 'string' ? load(saved) : saved;
    for (const profile of library.profiles) profiles.set(profile.id, profile);
    for (const id of library.handEdited ?? []) handEdited.add(id);
  }

  function remove(id: string): void {
    profiles.delete(id);
    handEdited.delete(id);
  }

  // Adds an imported fixture unless that would overwrite a hand-edited one.
  function add(result: FixtureImport, overwrite: boolean): ImportResult {
    const { id } = result.profile;
    if (handEdited.has(id) && !overwrite) return { ...result, status: 'conflict' };
    profiles.set(id, result.profile);
    handEdited.delete(id);
    return { ...result, status: 'imported' };
  }

  return {
    importOfl: (json, manufacturer, { overwrite = false } = {}) =>
      add(importOflFixture(json, manufacturer), overwrite),
    importGdtf: (bytes, { overwrite = false } = {}) => add(importGdtfFixture(bytes), overwrite),
    put(profile, { replaces } = {}) {
      const errors = validateProfile(profile);
      if (profile.id !== replaces && profiles.has(profile.id)) {
        errors.push(`A Profile with id "${profile.id}" already exists`);
      }
      if (errors.length > 0) return errors;
      if (replaces !== undefined) remove(replaces);
      profiles.set(profile.id, profile);
      handEdited.add(profile.id);
      return [];
    },
    remove,
    get: (id) => profiles.get(id),
    isHandEdited: (id) => handEdited.has(id),
    list: () =>
      [...profiles.values()].sort(
        (a, b) => a.manufacturer.localeCompare(b.manufacturer) || a.model.localeCompare(b.model),
      ),
    save() {
      const library: SavedLibrary = {
        version: VERSION,
        profiles: [...profiles.values()],
        handEdited: [...handEdited],
      };
      return JSON.stringify(library);
    },
  };
}

function load(saved: string): SavedLibrary {
  const library = JSON.parse(saved) as SavedLibrary;
  const error = versionError(library.version);
  if (error) throw new Error(error);
  return library;
}

function versionError(version: unknown): string | undefined {
  if (version === VERSION_1 || version === VERSION) return undefined;
  // Only a number is quoted: the startup error is logged, and the log keeps no
  // file contents.
  const quoted = typeof version === 'number' ? `: ${version}` : '';
  return `Unsupported Profile Library version${quoted}`;
}

// Reads a user-picked library file. Unlike startup loading, it checks every
// Profile, keeps the valid ones and lists the rest as skipped.
export function readLibraryFile(json: string): LibraryFileRead {
  let file: unknown;
  try {
    file = JSON.parse(json);
  } catch {
    return { status: 'rejected', reason: 'The file is not valid JSON' };
  }
  if (!isRecord(file) || !Array.isArray(file.profiles)) {
    return { status: 'rejected', reason: 'The file is not a Profile Library' };
  }
  const unsupported = versionError(file.version);
  if (unsupported) return { status: 'rejected', reason: unsupported };

  const kept = new Map<string, FixtureProfile>();
  const skipped: SkippedProfile[] = [];
  file.profiles.forEach((entry: unknown, index) => {
    const fields = isRecord(entry) ? entry : {};
    const error =
      typeof fields.id === 'string' && kept.has(fields.id) ? 'Duplicate id' : profileError(entry);
    if (error === undefined) {
      const profile = entry as FixtureProfile;
      kept.set(profile.id, profile);
      return;
    }
    skipped.push({
      index,
      ...(typeof fields.manufacturer === 'string' && { manufacturer: fields.manufacturer }),
      ...(typeof fields.model === 'string' && { model: fields.model }),
      error,
    });
  });
  if (kept.size === 0) return { status: 'rejected', reason: 'The file has no valid Profiles' };

  const handEdited = new Set(Array.isArray(file.handEdited) ? file.handEdited : []);
  return {
    status: 'readable',
    profiles: [...kept.values()],
    handEdited: [...handEdited].filter(
      (id): id is string => typeof id === 'string' && kept.has(id),
    ),
    skipped,
  };
}

// The first reason a file entry is not a valid Profile, or undefined. Checks
// the top-level shape, then defers to `validateProfile`.
function profileError(entry: unknown): string | undefined {
  const notAProfile = 'Not a Fixture Profile';
  if (
    !isRecord(entry) ||
    typeof entry.id !== 'string' ||
    typeof entry.manufacturer !== 'string' ||
    typeof entry.model !== 'string' ||
    !(ROLES as readonly unknown[]).includes(entry.defaultRole) ||
    !Array.isArray(entry.modes)
  ) {
    return notAProfile;
  }
  let errors: string[];
  try {
    errors = validateProfile(entry as unknown as FixtureProfile);
  } catch {
    // The validator trusts the Profile type; malformed nested data throws.
    return notAProfile;
  }
  return errors[0];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
