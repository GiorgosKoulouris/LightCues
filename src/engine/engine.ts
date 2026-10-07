import type { EngineCommand, EngineEvent, OflImportResult } from '../shared/protocol';
import { createOutputs, type SerialPorts } from './outputs';
import { createPlayback } from './playback';
import { createProfileLibrary, type ProfileLibrary } from './profile-library';
import { createShowSession, type ShowFiles } from './show-session';
import { createVenueSession, type VenueFiles } from './venue-session';

// Where the Profile Library is kept between runs.
export interface LibraryStorage {
  // The saved JSON, or undefined when nothing is saved yet.
  read(): string | undefined;
  write(json: string): void;
  // Moves unreadable saved JSON out of the way, so it is not overwritten.
  setAside(): void;
}

export interface EngineOptions {
  emit: (event: EngineEvent) => void;
  now?: () => number;
  storage?: LibraryStorage;
  venueFiles?: VenueFiles;
  showFiles?: ShowFiles;
  // Without it, nothing is sent to Outputs.
  serialPorts?: SerialPorts;
}

export interface Engine {
  handle(command: EngineCommand): void;
}

export function createEngine({
  emit,
  now = performance.now.bind(performance),
  storage,
  venueFiles,
  showFiles,
  serialPorts,
}: EngineOptions): Engine {
  const startedAt = now();
  const library = openLibrary(storage);
  const venue = createVenueSession({
    emit,
    changed: () => outputs?.patchChanged(),
    files: venueFiles,
    libraryProfile: (id) => library.get(id),
  });
  const show = createShowSession({
    emit,
    files: showFiles,
    edited: () => playback.showEdited(),
    replaced: () => playback.showReplaced(),
  });
  const playback = createPlayback({ emit, now, show: show.show, patch: venue.patch });
  const outputs =
    serialPorts &&
    createOutputs({
      ports: serialPorts,
      emit,
      universes: () => venue.patch().universes,
      frames: () => playback.frames(),
    });

  function libraryChanged(): void {
    storage?.write(library.save());
    emitProfiles();
  }

  function emitProfiles(): void {
    const entries = library
      .list()
      .map((profile) => ({ profile, handEdited: library.isHandEdited(profile.id) }));
    emit({ type: 'profiles', entries });
  }

  function importOfl(json: unknown, manufacturer: string, overwrite: boolean): OflImportResult {
    try {
      const { status, profile, unsupported } = library.importOfl(json, manufacturer, {
        overwrite,
      });
      if (status === 'conflict') return { status, profileId: profile.id };
      libraryChanged();
      return { status, profileId: profile.id, unsupported };
    } catch (error) {
      return { status: 'failed', error: (error as Error).message };
    }
  }

  return {
    handle(command) {
      switch (command.type) {
        case 'ping':
          emit({ type: 'pong', id: command.id, uptimeMs: now() - startedAt });
          break;
        case 'listProfiles':
          emitProfiles();
          break;
        case 'importOfl': {
          const { requestId, json, manufacturer, overwrite } = command;
          const result = importOfl(json, manufacturer, overwrite);
          emit({ type: 'oflImported', requestId, result });
          break;
        }
        case 'saveProfile': {
          const errors = library.put(command.profile, { replaces: command.replaces });
          if (errors.length === 0) libraryChanged();
          emit({ type: 'profileSaved', requestId: command.requestId, errors });
          break;
        }
        case 'deleteProfile':
          library.remove(command.id);
          libraryChanged();
          break;
        case 'getVenue':
        case 'newVenue':
        case 'openVenue':
        case 'saveVenue':
        case 'editVenue':
          venue.handle(command);
          break;
        case 'getShow':
        case 'newShow':
        case 'openShow':
        case 'saveShow':
        case 'editShow':
          show.handle(command);
          break;
        case 'getPlayback':
        case 'goScene':
        case 'clearLayer':
        case 'setMode':
          playback.handle(command);
          break;
        case 'listOutputs':
          outputs?.emitOutputs();
          break;
      }
    },
  };
}

function openLibrary(storage: LibraryStorage | undefined): ProfileLibrary {
  try {
    return createProfileLibrary(storage?.read());
  } catch (error) {
    console.error('Profile Library is unreadable; starting empty.', error);
    storage?.setAside();
    return createProfileLibrary();
  }
}
