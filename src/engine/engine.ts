import { basename } from 'node:path';
import {
  DOCUMENTS,
  type EngineCommand,
  type EngineEvent,
  type FixtureImportResult,
  type LibraryImportPreview,
  type LibraryImportResult,
} from '../shared/protocol';
import { findTrigger } from '../shared/show';
import { profileName } from '../shared/profile-edit';
import { withoutContents } from './log-safe';
import {
  createMidiInput,
  type MidiInputStorage,
  type MidiPorts,
  type NoteMessage,
} from './midi-input';
import { createOutputs, type SerialPorts } from './outputs';
import { createPathGrants, NOT_CHOSEN } from './path-grants';
import { createPlayback } from './playback';
import { createPreview } from './preview';
import {
  createProfileLibrary,
  readLibraryFile,
  type ImportResult,
  type LibraryContents,
  type ProfileLibrary,
} from './profile-library';
import {
  createRecentFiles,
  type RecentFile,
  type RecentFilesStorage,
  type RecentKind,
} from './recent-files';
import { createShowSession, type ShowFiles } from './show-session';
import { createTempo } from './tempo';
import { createVenueSession, type VenueFiles } from './venue-session';

// Where the Profile Library is kept between runs.
export interface LibraryStorage {
  // The saved JSON, or undefined when nothing is saved yet.
  read(): string | undefined;
  write(json: string): void;
  // Moves unreadable saved JSON out of the way, so it is not overwritten.
  setAside(): void;
}

// Reads and writes library files the user picked, by path. Both throw on
// failure.
export interface LibraryFiles {
  read(path: string): string;
  write(path: string, json: string): void;
}

// Copies of the library kept before an import replaces it.
export interface LibraryBackups {
  // Writes a new backup and returns its path. Throws on failure.
  save(json: string): string;
}

export interface EngineOptions {
  emit: (event: EngineEvent) => void;
  now?: () => number;
  storage?: LibraryStorage;
  // Without them, the library cannot be exported or imported.
  libraryFiles?: LibraryFiles;
  // Without them, no import is confirmed.
  libraryBackups?: LibraryBackups;
  venueFiles?: VenueFiles;
  showFiles?: ShowFiles;
  // Without it, nothing is sent to Outputs.
  serialPorts?: SerialPorts;
  // Without them, no Trigger fires.
  midiPorts?: MidiPorts;
  midiInputStorage?: MidiInputStorage;
  // Without it, nothing is reopened on launch.
  recentFilesStorage?: RecentFilesStorage;
}

export interface Engine {
  handle(command: EngineCommand): void;
  // Lets commands read and write `path`, which the user picked in a dialog.
  grantPath(path: string): void;
}

export function createEngine({
  emit,
  now = performance.now.bind(performance),
  storage,
  libraryFiles,
  libraryBackups,
  venueFiles,
  showFiles,
  serialPorts,
  midiPorts,
  midiInputStorage,
  recentFilesStorage,
}: EngineOptions): Engine {
  const startedAt = now();
  let library = openLibrary(storage);
  // A previewed library file, waiting for the user to confirm it.
  let pendingImport: { path: string; contents: LibraryContents } | undefined;
  const recentFiles = createRecentFiles(recentFilesStorage);
  const grants = createPathGrants();
  const venue = createVenueSession({
    emit,
    now,
    changed: () => outputs?.patchChanged(),
    replaced: () => playback.venueReplaced(),
    files: venueFiles,
    recent: recentFiles.of('venue'),
    granted: grants.has,
    libraryProfile: (id) => library.get(id),
  });
  const show = createShowSession({
    emit,
    now,
    files: showFiles,
    recent: recentFiles.of('show'),
    granted: grants.has,
    edited: () => playback.showEdited(),
    replaced: () => playback.showReplaced(),
  });
  const tempo = createTempo({ now, emit });
  const playback = createPlayback({
    emit,
    now,
    beat: tempo.beat,
    show: show.show,
    patch: venue.patch,
  });
  const outputs =
    serialPorts &&
    createOutputs({
      ports: serialPorts,
      emit,
      universes: () => venue.patch().universes,
      frames: () => playback.frames(),
    });

  const preview = createPreview({ emit, lights: () => playback.lights() });

  const midiInput =
    midiPorts &&
    createMidiInput({
      ports: midiPorts,
      storage: midiInputStorage,
      emit,
      onNote: noteReceived,
      onClock: () => tempo.clockTick(),
    });
  // While MIDI learn waits, the next note-on is reported instead of fired.
  // Note-offs still release held Flashes.
  let learning = false;

  function noteReceived({ on, ...note }: NoteMessage): void {
    if (!on) return playback.noteOff(note);
    if (learning) {
      learning = false;
      emit({ type: 'triggerLearned', note });
      return;
    }
    const trigger = findTrigger(show.show(), note);
    if (trigger) playback.fire(trigger);
  }

  function libraryChanged(): void {
    storage?.write(library.save());
    emitProfiles();
  }

  function emitProfiles(): void {
    const entries = library
      .list()
      .map((profile) => ({ profile, handEdited: library.isHandEdited(profile.id) }));
    const folder = recentFiles.library.folder();
    emit({ type: 'profiles', entries, ...(folder === undefined ? {} : { folder }) });
  }

  // Writes the whole library to a file the user picked. Returns errors; an
  // empty list means it was written.
  function exportLibrary(path: string): string[] {
    if (!libraryFiles) return ['Library files are not available'];
    if (!grants.has(path)) return [`Could not export ${path}: ${NOT_CHOSEN}`];
    try {
      libraryFiles.write(path, library.save());
    } catch (error) {
      return [`Could not export ${path}: ${(error as Error).message}`];
    }
    recentFiles.library.set(path);
    // Sends the new Export folder with the Profiles.
    emitProfiles();
    return [];
  }

  // Reads a library file to import. A readable one becomes the pending import.
  function previewLibraryImport(path: string): LibraryImportPreview {
    pendingImport = undefined;
    if (!libraryFiles) return { status: 'rejected', reason: 'Library files are not available' };
    if (!grants.has(path))
      return { status: 'rejected', reason: `Could not read ${path}: ${NOT_CHOSEN}` };
    let json: string;
    try {
      json = libraryFiles.read(path);
    } catch (error) {
      return { status: 'rejected', reason: `Could not read ${path}: ${(error as Error).message}` };
    }
    const read = readLibraryFile(json);
    if (read.status === 'rejected') return read;
    const { profiles, handEdited, skipped } = read;
    pendingImport = { path, contents: { profiles, handEdited } };
    return {
      status: 'readable',
      fileName: basename(path),
      currentCount: library.list().length,
      keptCount: profiles.length,
      skipped,
    };
  }

  // Backs up the library, then replaces it with the pending import. A failed
  // backup leaves the library as it was.
  function confirmLibraryImport(): LibraryImportResult {
    const pending = pendingImport;
    pendingImport = undefined;
    if (!pending) return { status: 'failed', error: 'No import is pending' };
    if (!libraryBackups) return { status: 'failed', error: 'Backups are not available' };
    let backupPath: string;
    try {
      backupPath = libraryBackups.save(library.save());
    } catch (error) {
      return {
        status: 'failed',
        error: `Could not back up the Profile Library: ${(error as Error).message}`,
      };
    }
    library = createProfileLibrary(pending.contents);
    recentFiles.library.set(pending.path);
    libraryChanged();
    return { status: 'imported', keptCount: pending.contents.profiles.length, backupPath };
  }

  // Runs a Profile Library import and describes its result for the UI.
  function importFixture(run: () => ImportResult): FixtureImportResult {
    try {
      const { status, profile, unsupported } = run();
      if (status === 'conflict')
        return { status, profileId: profile.id, name: profileName(profile) };
      libraryChanged();
      return { status, profileId: profile.id, name: profileName(profile), unsupported };
    } catch (error) {
      return { status: 'failed', error: (error as Error).message };
    }
  }

  // Reopens the last Venue Patch and Show. Failures wait for the UI to ask,
  // once, since no UI is connected yet.
  let reopenErrors = [
    ...reopen('venue', venue, recentFiles.of('venue'), grants.grant),
    ...reopen('show', show, recentFiles.of('show'), grants.grant),
  ];

  return {
    grantPath: grants.grant,
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
          const result = importFixture(() => library.importOfl(json, manufacturer, { overwrite }));
          emit({ type: 'fixtureImported', requestId, result });
          break;
        }
        case 'importGdtf': {
          const { requestId, bytes, overwrite } = command;
          const result = importFixture(() => library.importGdtf(bytes, { overwrite }));
          emit({ type: 'fixtureImported', requestId, result });
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
        case 'exportLibrary': {
          const errors = exportLibrary(command.path);
          emit({ type: 'libraryExported', requestId: command.requestId, errors });
          break;
        }
        case 'previewLibraryImport': {
          const preview = previewLibraryImport(command.path);
          emit({ type: 'libraryImportPreview', requestId: command.requestId, preview });
          break;
        }
        case 'confirmLibraryImport': {
          const result = confirmLibraryImport();
          emit({ type: 'libraryImported', requestId: command.requestId, result });
          break;
        }
        case 'cancelLibraryImport':
          pendingImport = undefined;
          break;
        case 'getVenue':
        case 'newVenue':
        case 'openVenue':
        case 'saveVenue':
        case 'editVenue':
        case 'undoVenue':
        case 'redoVenue':
          venue.handle(command);
          break;
        case 'getShow':
        case 'newShow':
        case 'openShow':
        case 'saveShow':
        case 'editShow':
        case 'undoShow':
        case 'redoShow':
          show.handle(command);
          break;
        case 'getPlayback':
        case 'goScene':
        case 'clearLayer':
        case 'goBaseLook':
        case 'setMode':
        case 'setGrandMaster':
        case 'setBlackout':
        case 'setFreeze':
        case 'setFocusCheck':
          playback.handle(command);
          break;
        case 'listOutputs':
          outputs?.emitOutputs();
          break;
        case 'listMidiInputs':
          midiInput?.emitStatus();
          break;
        case 'selectMidiInput':
          midiInput?.select(command.name);
          break;
        case 'learnTrigger':
          learning = true;
          break;
        case 'cancelLearn':
          learning = false;
          break;
        case 'getTempo':
          tempo.emitTempo();
          break;
        case 'tapTempo':
          tempo.tap();
          break;
        case 'getReopenErrors':
          emit({ type: 'reopenErrors', errors: reopenErrors });
          reopenErrors = [];
          break;
        case 'startPreview':
          preview.start();
          break;
        case 'stopPreview':
          preview.stop();
          break;
      }
    },
  };
}

// Opens a document's last file, if any. The engine kept that path itself, so
// it is granted. One that fails is forgotten.
function reopen(
  kind: RecentKind,
  session: { open(path: string): string[] },
  recent: RecentFile,
  grant: (path: string) => void,
): string[] {
  const file = recent.file();
  if (file === undefined) return [];
  grant(file);
  const errors = session.open(file);
  if (errors.length === 0) return [];
  recent.set(undefined);
  return errors.map((error) => `The last ${DOCUMENTS[kind]} was not reopened. ${error}`);
}

function openLibrary(storage: LibraryStorage | undefined): ProfileLibrary {
  try {
    return createProfileLibrary(storage?.read());
  } catch (error) {
    console.error('Profile Library is unreadable; starting empty.', withoutContents(error));
    storage?.setAside();
    return createProfileLibrary();
  }
}
