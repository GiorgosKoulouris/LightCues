import {
  DOCUMENTS,
  type EngineCommand,
  type EngineEvent,
  type FixtureImportResult,
} from '../shared/protocol';
import { findTrigger } from '../shared/show';
import { profileName } from '../shared/profile-edit';
import {
  createMidiInput,
  type MidiInputStorage,
  type MidiPorts,
  type NoteMessage,
} from './midi-input';
import { createOutputs, type SerialPorts } from './outputs';
import { createPlayback } from './playback';
import { createPreview } from './preview';
import { createProfileLibrary, type ImportResult, type ProfileLibrary } from './profile-library';
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

export interface EngineOptions {
  emit: (event: EngineEvent) => void;
  now?: () => number;
  storage?: LibraryStorage;
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
}

export function createEngine({
  emit,
  now = performance.now.bind(performance),
  storage,
  venueFiles,
  showFiles,
  serialPorts,
  midiPorts,
  midiInputStorage,
  recentFilesStorage,
}: EngineOptions): Engine {
  const startedAt = now();
  const library = openLibrary(storage);
  const recentFiles = createRecentFiles(recentFilesStorage);
  const venue = createVenueSession({
    emit,
    now,
    changed: () => outputs?.patchChanged(),
    replaced: () => playback.venueReplaced(),
    files: venueFiles,
    recent: recentFiles.of('venue'),
    libraryProfile: (id) => library.get(id),
  });
  const show = createShowSession({
    emit,
    now,
    files: showFiles,
    recent: recentFiles.of('show'),
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
    emit({ type: 'profiles', entries });
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
    ...reopen('venue', venue, recentFiles.of('venue')),
    ...reopen('show', show, recentFiles.of('show')),
  ];

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

// Opens a document's last file, if any. One that fails is forgotten.
function reopen(
  kind: RecentKind,
  session: { open(path: string): string[] },
  recent: RecentFile,
): string[] {
  const file = recent.file();
  if (file === undefined) return [];
  const errors = session.open(file);
  if (errors.length === 0) return [];
  recent.set(undefined);
  return errors.map((error) => `The last ${DOCUMENTS[kind]} was not reopened. ${error}`);
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
