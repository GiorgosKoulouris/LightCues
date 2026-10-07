import type { FixtureProfile } from '../shared/fixture-profile';
import type { EngineCommand, EngineEvent, VenueEdit } from '../shared/protocol';
import {
  addUniverse,
  emptyPatch,
  moveFixture,
  putFixture,
  putUniverse,
  removeFixture,
  removeUniverse,
  setStage,
  type PatchResult,
  type StageBounds,
  type VenuePatch,
} from '../shared/venue-patch';
import { loadVenueFile, saveVenueFile } from './venue-file';

// A new patch's stage until the user sets the venue's.
const DEFAULT_STAGE: StageBounds = { width: 10, depth: 8 };

export type VenueCommand = Extract<
  EngineCommand,
  { type: 'getVenue' | 'newVenue' | 'openVenue' | 'saveVenue' | 'editVenue' }
>;

// Reads and writes .lcvenue files by path. Both throw on failure.
export interface VenueFiles {
  read(path: string): string;
  write(path: string, json: string): void;
}

export interface VenueSessionOptions {
  emit: (event: EngineEvent) => void;
  files?: VenueFiles;
  // A Profile from the Profile Library, for Fixtures the patch has no copy of.
  libraryProfile: (id: string) => FixtureProfile | undefined;
}

// The engine's current Venue Patch.
export function createVenueSession({ emit, files, libraryProfile }: VenueSessionOptions) {
  let patch: VenuePatch = emptyPatch(DEFAULT_STAGE);
  // The file the patch was opened from or last saved to.
  let path: string | undefined;
  let unsaved = false;

  function emitVenue(): void {
    emit({ type: 'venue', patch, ...(path === undefined ? {} : { path }), unsaved });
  }

  function open(from: string): string[] {
    if (!files) return ['Venue files are not available'];
    try {
      patch = loadVenueFile(files.read(from));
    } catch (error) {
      return [`Could not open ${from}: ${(error as Error).message}`];
    }
    path = from;
    unsaved = false;
    emitVenue();
    return [];
  }

  function save(to = path): string[] {
    if (!files) return ['Venue files are not available'];
    if (to === undefined) return ['Choose a file to save the Venue Patch to'];
    try {
      files.write(to, saveVenueFile(patch));
    } catch (error) {
      return [`Could not save ${to}: ${(error as Error).message}`];
    }
    path = to;
    unsaved = false;
    emitVenue();
    return [];
  }

  function edit(change: VenueEdit): PatchResult {
    switch (change.type) {
      case 'setStage':
        return setStage(patch, change.stage);
      case 'addUniverse':
        return addUniverse(patch, change.universe);
      case 'putUniverse':
        return putUniverse(patch, change.universe);
      case 'removeUniverse':
        if (!patch.universes.some((u) => u.number === change.number)) {
          return { errors: [`Universe ${change.number} is not in the patch`] };
        }
        return { patch: removeUniverse(patch, change.number) };
      case 'putFixture':
        return putFixture(patch, change.fixture, libraryProfile(change.fixture.profileId));
      case 'moveFixture':
        return moveFixture(patch, change.id, change.position);
      case 'removeFixture':
        if (!patch.fixtures.some((f) => f.id === change.id)) {
          return { errors: [`Fixture id "${change.id}" is not in the patch`] };
        }
        return { patch: removeFixture(patch, change.id) };
    }
  }

  return {
    handle(command: VenueCommand): void {
      switch (command.type) {
        case 'getVenue':
          emitVenue();
          break;
        case 'newVenue':
          patch = emptyPatch(DEFAULT_STAGE);
          path = undefined;
          unsaved = false;
          emitVenue();
          break;
        case 'openVenue':
          emit({ type: 'venueDone', requestId: command.requestId, errors: open(command.path) });
          break;
        case 'saveVenue':
          emit({ type: 'venueDone', requestId: command.requestId, errors: save(command.path) });
          break;
        case 'editVenue': {
          const result = edit(command.edit);
          if ('patch' in result) {
            patch = result.patch;
            unsaved = true;
            emitVenue();
          }
          const errors = 'errors' in result ? result.errors : [];
          emit({ type: 'venueDone', requestId: command.requestId, errors });
          break;
        }
      }
    },
  };
}
