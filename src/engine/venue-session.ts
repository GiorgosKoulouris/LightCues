import type { FixtureProfile } from '../shared/fixture-profile';
import type { EngineCommand, EngineEvent, VenueEdit } from '../shared/protocol';
import {
  addUniverse,
  emptyPatch,
  moveFixture,
  putFixture,
  putFixtures,
  putUniverse,
  removeFixtures,
  removeUniverse,
  setStage,
  type PatchResult,
  type StageBounds,
  type VenuePatch,
} from '../shared/venue-patch';
import { createHistory } from './history';
import type { RecentFile } from './recent-files';
import { loadVenueFile, saveVenueFile } from './venue-file';

// A new patch's stage until the user sets the venue's.
const DEFAULT_STAGE: StageBounds = { width: 10, depth: 8 };

export type VenueCommand = Extract<
  EngineCommand,
  {
    type:
      'getVenue' | 'newVenue' | 'openVenue' | 'saveVenue' | 'editVenue' | 'undoVenue' | 'redoVenue';
  }
>;

// Reads and writes .lcvenue files by path. Both throw on failure.
export interface VenueFiles {
  read(path: string): string;
  write(path: string, json: string): void;
}

export interface VenueSessionOptions {
  emit: (event: EngineEvent) => void;
  // Times edits, so quick ones to the same thing undo as one.
  now: () => number;
  files?: VenueFiles;
  // Kept up to date with the file the patch was opened from or last saved to.
  recent?: RecentFile;
  // Called after the patch is replaced, edited, undone or redone.
  changed?: () => void;
  // A Profile from the Profile Library, for Fixtures the patch has no copy of.
  libraryProfile: (id: string) => FixtureProfile | undefined;
}

// The engine's current Venue Patch.
export function createVenueSession({
  emit,
  now,
  files,
  recent,
  changed,
  libraryProfile,
}: VenueSessionOptions) {
  const history = createHistory(emptyPatch(DEFAULT_STAGE), { now });
  // The file the patch was opened from or last saved to.
  let path: string | undefined;

  function emitVenue(): void {
    emit({
      type: 'venue',
      patch: history.current(),
      ...(path === undefined ? {} : { path }),
      ...folder(),
      ...history.state(),
    });
  }

  // The folder file dialogs start in, when one is known.
  function folder(): { folder?: string } {
    const known = recent?.folder();
    return known === undefined ? {} : { folder: known };
  }

  function open(from: string): string[] {
    if (!files) return ['Venue files are not available'];
    try {
      history.reset(loadVenueFile(files.read(from)));
    } catch (error) {
      return [`Could not open ${from}: ${(error as Error).message}`];
    }
    path = from;
    recent?.set(path);
    emitVenue();
    changed?.();
    return [];
  }

  function save(to = path): string[] {
    if (!files) return ['Venue files are not available'];
    if (to === undefined) return ['Choose a file to save the Venue Patch to'];
    try {
      files.write(to, saveVenueFile(history.current()));
    } catch (error) {
      return [`Could not save ${to}: ${(error as Error).message}`];
    }
    path = to;
    recent?.set(path);
    history.markSaved();
    emitVenue();
    return [];
  }

  function edit(change: VenueEdit): PatchResult {
    const patch = history.current();
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
      case 'putFixtures':
        return putFixtures(patch, change.fixtures, libraryProfile);
      case 'moveFixture':
        return moveFixture(patch, change.id, change.position);
      case 'removeFixtures': {
        const missing = change.ids.find((id) => !patch.fixtures.some((f) => f.id === id));
        if (missing !== undefined) {
          return { errors: [`Fixture id "${missing}" is not in the patch`] };
        }
        return { patch: removeFixtures(patch, change.ids) };
      }
    }
  }

  // Undo or redo, when there is a step to take.
  function step(taken: boolean): void {
    if (!taken) return;
    emitVenue();
    changed?.();
  }

  return {
    patch: () => history.current(),
    // Opens a file. An empty list of errors means it opened.
    open,
    handle(command: VenueCommand): void {
      switch (command.type) {
        case 'getVenue':
          emitVenue();
          break;
        case 'newVenue':
          history.reset(emptyPatch(DEFAULT_STAGE));
          path = undefined;
          recent?.set(undefined);
          emitVenue();
          changed?.();
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
            history.edit(result.patch, mergeKey(history.current(), command.edit));
            emitVenue();
            changed?.();
          }
          const errors = 'errors' in result ? result.errors : [];
          emit({ type: 'venueDone', requestId: command.requestId, errors });
          break;
        }
        case 'undoVenue':
          step(history.undo());
          break;
        case 'redoVenue':
          step(history.redo());
          break;
      }
    },
  };
}

// What an edit changes, for merging quick edits into one undo step: the
// stage, an existing Universe, or the same existing Fixtures. Adding,
// removing and moving on the stage plan never merge.
function mergeKey(patch: VenuePatch, change: VenueEdit): string | undefined {
  const patched = (id: string) => patch.fixtures.some((f) => f.id === id);
  switch (change.type) {
    case 'setStage':
      return 'stage';
    case 'putUniverse': {
      const { number } = change.universe;
      return patch.universes.some((u) => u.number === number) ? `universe ${number}` : undefined;
    }
    case 'putFixture':
    case 'putFixtures': {
      const ids =
        change.type === 'putFixture' ? [change.fixture.id] : change.fixtures.map((f) => f.id);
      return ids.every(patched) ? `fixtures ${[...ids].sort().join(' ')}` : undefined;
    }
    default:
      return undefined;
  }
}
