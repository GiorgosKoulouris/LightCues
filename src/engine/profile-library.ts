import type { FixtureProfile } from '../shared/fixture-profile';
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

export function createProfileLibrary(saved?: string): ProfileLibrary {
  const profiles = new Map<string, FixtureProfile>();
  const handEdited = new Set<string>();
  if (saved) {
    const library = load(saved);
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
  if (library.version !== VERSION_1 && library.version !== VERSION) {
    throw new Error(`Unsupported Profile Library version: ${library.version}`);
  }
  return library;
}
