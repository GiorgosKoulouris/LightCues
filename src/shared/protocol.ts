// The typed message contract between the UI and the engine process.
// The UI sends EngineCommands; the engine sends EngineEvents.
import type { AimAngles } from './aim';
import type { FixtureProfile, UnsupportedFeature } from './fixture-profile';
import type { Colour, Direction, Layer, MidiNote, Scene, Show, Trigger } from './show';
import type {
  PatchedFixture,
  StageBounds,
  StagePosition,
  Universe,
  VenuePatch,
} from './venue-patch';

export type EngineCommand =
  | { type: 'ping'; id: number }
  | { type: 'listProfiles' }
  // `json` is a parsed OFL fixture file. Without `overwrite`, a Profile edited
  // by hand is kept and the result is a `conflict`.
  | {
      type: 'importOfl';
      requestId: number;
      json: unknown;
      manufacturer: string;
      overwrite: boolean;
    }
  // `bytes` is a .gdtf file, imported like an OFL fixture.
  | { type: 'importGdtf'; requestId: number; bytes: Uint8Array; overwrite: boolean }
  // `replaces` is the id of the Profile being edited; absent for a new one.
  | { type: 'saveProfile'; requestId: number; profile: FixtureProfile; replaces?: string }
  | { type: 'deleteProfile'; id: string }
  // Writes the whole library to `path`, an .lclibrary file.
  | { type: 'exportLibrary'; requestId: number; path: string }
  // Reads a library file to import and keeps it as the pending import,
  // replacing any earlier one. Changes nothing yet.
  | { type: 'previewLibraryImport'; requestId: number; path: string }
  // Backs up the library, then replaces it with the pending import.
  | { type: 'confirmLibraryImport'; requestId: number }
  // Drops the pending import.
  | { type: 'cancelLibraryImport' }
  // The current Venue Patch. `path` is an .lcvenue file; `saveVenue` without
  // one saves to the file the patch was opened from or last saved to.
  | { type: 'getVenue' }
  | { type: 'newVenue' }
  | { type: 'openVenue'; requestId: number; path: string }
  | { type: 'saveVenue'; requestId: number; path?: string }
  | { type: 'editVenue'; requestId: number; edit: VenueEdit }
  // Undo or redo the last edit; nothing when there is none. New and Open
  // forget the history.
  | { type: 'undoVenue' }
  | { type: 'redoVenue' }
  | { type: 'listOutputs' }
  // The current Show, handled like the Venue Patch. `path` is an .lcshow file.
  | { type: 'getShow' }
  | { type: 'newShow' }
  | { type: 'openShow'; requestId: number; path: string }
  | { type: 'saveShow'; requestId: number; path?: string }
  | { type: 'editShow'; requestId: number; edit: ShowEdit }
  | { type: 'undoShow' }
  | { type: 'redoShow' }
  // Active Scenes, the mode and the Fallback Panel. `goScene` replaces the
  // active Scene in its Layer, fading in; `clearLayer` clears it at once.
  // `goBaseLook` clears every Layer and goes to the Base Look, if the Show has
  // one. The Grand Master `level` is 0–1. Blackout sets every Fixture's
  // intensity to 0 until turned off, in Blind too; the Scenes stay active.
  | { type: 'getPlayback' }
  | { type: 'goScene'; sceneId: string }
  | { type: 'clearLayer'; layerId: string }
  | { type: 'goBaseLook' }
  | { type: 'setMode'; mode: PlaybackMode }
  | { type: 'setGrandMaster'; level: number }
  | { type: 'setBlackout'; on: boolean }
  // Freeze holds every movement Effect at its offset until turned off, when
  // they jump to where the beat has got to. Directions and fades still apply.
  | { type: 'setFreeze'; on: boolean }
  // Focus Check: every moving Fixture aims at `direction`, open at full in
  // white, on the Outputs in Blind too. Blackout still wins. Without a
  // Direction, it is off. Off on New and Open of a Venue Patch.
  | { type: 'setFocusCheck'; direction?: Direction }
  | { type: 'listMidiInputs' }
  // The MIDI input that Triggers listen to, chosen by port name. Without a
  // name, none is used.
  | { type: 'selectMidiInput'; name?: string }
  // MIDI learn: the next note-on is reported as `triggerLearned` instead of
  // firing its Trigger.
  | { type: 'learnTrigger' }
  | { type: 'cancelLearn' }
  // The current Tempo, sent as a `tempo` event.
  | { type: 'getTempo' }
  // Tap Tempo: the average of the last taps sets the Tempo.
  | { type: 'tapTempo' }
  // Why the last Venue Patch or Show did not reopen on launch. Sent once;
  // later requests get an empty list.
  | { type: 'getReopenErrors' }
  // While started, the engine sends `preview` events.
  | { type: 'startPreview' }
  | { type: 'stopPreview' };

// Monitor sends the active Scenes to the Outputs. Blind holds the Outputs at
// the frames sent last.
export type PlaybackMode = 'monitor' | 'blind';

// How a Fixture looks in the preview: its intensity, 0–1 after the Grand
// Master, and the colour it shows at full, red, green and blue each 0–1. A
// moving Fixture also has the pan and tilt it is sent.
export interface FixtureLight {
  intensity: number;
  red: number;
  green: number;
  blue: number;
  aim?: AimAngles;
}

// The active Scene id per Layer id. A Layer without an entry is clear.
export type ActiveByLayer = Record<string, string>;

// A change to the current Show.
export type ShowEdit =
  | { type: 'putScene'; scene: Scene }
  | { type: 'removeScene'; id: string }
  | { type: 'putLayer'; layer: Layer }
  // Removes the Layer's Scenes too.
  | { type: 'removeLayer'; id: string }
  | { type: 'setBaseLook'; sceneId?: string }
  // Without a colour, the default is White.
  | { type: 'setDefaultColour'; colour?: Colour }
  // Without a Direction, the default is Down.
  | { type: 'setDefaultDirection'; direction?: Direction }
  // The Fallback Panel's Scene buttons, in order. Empty for none.
  | { type: 'setPanelScenes'; sceneIds: string[] }
  // Replaces the Trigger on the same channel and note.
  | { type: 'putTrigger'; trigger: Trigger }
  | { type: 'removeTrigger'; note: MidiNote };

// A change to the current Venue Patch. `putFixture` and `putFixtures` embed a
// Fixture's Profile from the Profile Library when the patch does not have it
// yet. `putFixtures` changes several Fixtures at once, or none if one does not
// fit.
export type VenueEdit =
  | { type: 'setStage'; stage: StageBounds }
  // `addUniverse` rejects a number already in the patch; `putUniverse`
  // replaces that Universe.
  | { type: 'addUniverse'; universe: Universe }
  | { type: 'putUniverse'; universe: Universe }
  | { type: 'removeUniverse'; number: number }
  | { type: 'putFixture'; fixture: PatchedFixture }
  | { type: 'putFixtures'; fixtures: PatchedFixture[] }
  | { type: 'moveFixture'; id: string; position: StagePosition }
  | { type: 'removeFixtures'; ids: string[] };

// A DMX interface port that Universes are sent to. `id` is what a Universe's
// `output` names: the device's USB serial number, or its port when it has
// none. States:
// - unused: found, but no Universe is mapped to it.
// - connecting: opening its port.
// - sending: sending its Universe's frames.
// - failed: could not open or write; retried on the next scan.
// - missing: a Universe is mapped to it, but it is not plugged in.
export interface OutputStatus {
  id: string;
  name: string;
  state: 'unused' | 'connecting' | 'sending' | 'failed' | 'missing';
  error?: string;
}

// The MIDI input ports and the one Triggers listen to. States:
// - none: no port is selected.
// - connected: listening to the selected port.
// - lost: the selected port went away; the current look is held until it
//   returns.
// - failed: the selected port could not be opened; retried on the next scan.
export interface MidiInputStatus {
  ports: string[];
  selected?: string;
  state: 'none' | 'connected' | 'lost' | 'failed';
  error?: string;
}

// Where the Tempo comes from: nothing yet (120 BPM), the MIDI Input's MIDI
// Clock, the clock's last Tempo held after it stopped, or Tap Tempo.
export type TempoSource = 'default' | 'clock' | 'held' | 'tap';

export interface ProfileLibraryEntry {
  profile: FixtureProfile;
  handEdited: boolean;
}

// `name` is the Profile's manufacturer and model, as shown in messages.
export type FixtureImportResult =
  | { status: 'imported'; profileId: string; name: string; unsupported: UnsupportedFeature[] }
  | { status: 'conflict'; profileId: string; name: string }
  | { status: 'failed'; error: string };

// A Profile left out of an imported library file. `index` is its zero-based
// position in the file; `manufacturer` and `model` are there when readable.
export interface SkippedProfile {
  index: number;
  manufacturer?: string;
  model?: string;
  error: string;
}

// What confirming an import would do: replace `currentCount` Profiles with
// `keptCount` from `fileName`, skipping the rest. A rejected file changes
// nothing.
export type LibraryImportPreview =
  | { status: 'rejected'; reason: string }
  | {
      status: 'readable';
      fileName: string;
      currentCount: number;
      keptCount: number;
      skipped: SkippedProfile[];
    };

// What confirming an import did. On failure the library is unchanged.
export type LibraryImportResult =
  | { status: 'imported'; keptCount: number; backupPath: string }
  | { status: 'failed'; error: string };

export type EngineEvent =
  | { type: 'pong'; id: number; uptimeMs: number }
  // The whole Profile Library, sent on request and after every change.
  // `folder` is where its Export dialog starts.
  | { type: 'profiles'; entries: ProfileLibraryEntry[]; folder?: string }
  | { type: 'fixtureImported'; requestId: number; result: FixtureImportResult }
  // An empty `errors` list means the Profile was saved.
  | { type: 'profileSaved'; requestId: number; errors: string[] }
  // Reply to exportLibrary. An empty `errors` list means it was written.
  | { type: 'libraryExported'; requestId: number; errors: string[] }
  // Reply to previewLibraryImport.
  | { type: 'libraryImportPreview'; requestId: number; preview: LibraryImportPreview }
  // Reply to confirmLibraryImport.
  | { type: 'libraryImported'; requestId: number; result: LibraryImportResult }
  // The current Venue Patch, sent on request and after every change. `unsaved`
  // is true when it differs from what was last written to a file. `folder` is
  // where its Open and Save As dialogs start.
  | ({ type: 'venue'; patch: VenuePatch; path?: string; folder?: string } & DocumentState)
  // Reply to openVenue, saveVenue and editVenue. An empty `errors` list means
  // it was done.
  | { type: 'venueDone'; requestId: number; errors: string[] }
  // All Outputs, sent on request and after every change.
  | { type: 'outputs'; outputs: OutputStatus[] }
  // The current Show, sent on request and after every change.
  | ({ type: 'show'; show: Show; path?: string; folder?: string } & DocumentState)
  // Reply to openShow, saveShow and editShow. An empty `errors` list means it
  // was done.
  | { type: 'showDone'; requestId: number; errors: string[] }
  // The active Scenes, the mode, the Grand Master (0–1), whether Blackout
  // and Freeze are on, and the Focus Check's Direction while it is on. Sent on
  // request and after every change.
  | {
      type: 'playback';
      active: ActiveByLayer;
      mode: PlaybackMode;
      grandMaster: number;
      blackout: boolean;
      freeze: boolean;
      focusCheck?: Direction;
    }
  // The MIDI input status. Sent on request and after every change.
  | { type: 'midiInput'; status: MidiInputStatus }
  // The Tempo and where it comes from. Sent on request and after every change
  // of its source or of its BPM to one decimal.
  | { type: 'tempo'; bpm: number; source: TempoSource }
  // The note-on caught by MIDI learn.
  | { type: 'triggerLearned'; note: MidiNote }
  | { type: 'reopenErrors'; errors: string[] }
  // How every Fixture in the Venue Patch looks now, by Fixture id. In Monitor
  // it is what the Outputs send; in Blind, what they would send. Sent while
  // the preview is started, on start and after every change.
  | { type: 'preview'; lights: Record<string, FixtureLight> };

// Whether a Show or Venue Patch has unsaved changes, and edits to undo or redo.
export interface DocumentState {
  unsaved: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

// Sent by the main process to the engine with a fresh UI MessagePort attached.
export type EngineConnect = { type: 'connect' };

// Sent by the main process to the engine after the user picked `path` in a
// file dialog. Engine commands read and write only granted paths.
export type EngineGrantPath = { type: 'grantPath'; path: string };

// The engine's reply to a grant, on the parent port. Main hands the path to
// the renderer only after it: the parent and UI ports are separate channels,
// so a command could otherwise beat its grant.
export type EnginePathGranted = { type: 'pathGranted'; path: string };

// IPC channel on which the main process hands the renderer its engine port.
export const ENGINE_PORT_CHANNEL = 'engine:port';

// What the preload script exposes to the renderer as `window.engine`.
export interface EngineBridge {
  send(command: EngineCommand): void;
  // Returns an unsubscribe function.
  onEvent(listener: (event: EngineEvent) => void): () => void;
}

// IPC channels on which the renderer asks main for a native file dialog.
export const CHOOSE_VENUE_TO_OPEN_CHANNEL = 'dialog:chooseVenueToOpen';
export const CHOOSE_VENUE_TO_SAVE_CHANNEL = 'dialog:chooseVenueToSave';
export const CHOOSE_SHOW_TO_OPEN_CHANNEL = 'dialog:chooseShowToOpen';
export const CHOOSE_SHOW_TO_SAVE_CHANNEL = 'dialog:chooseShowToSave';
export const CHOOSE_LIBRARY_TO_OPEN_CHANNEL = 'dialog:chooseLibraryToOpen';
export const CHOOSE_LIBRARY_TO_SAVE_CHANNEL = 'dialog:chooseLibraryToSave';
export const SHOW_LIBRARY_BACKUP_CHANNEL = 'shell:showLibraryBackup';
// The folder beside the Profile Library file that holds its backups.
export const LIBRARY_BACKUPS_FOLDER = 'backups';

// What the preload script exposes to the renderer as `window.dialogs`. Each
// resolves to the chosen path, or undefined when the user cancels. A dialog
// starts at the `current` file, else in `folder` when it still exists. A
// library has no current file: its Save dialog suggests `name` in `folder`.
export interface DialogBridge {
  chooseVenueToOpen(folder?: string): Promise<string | undefined>;
  chooseVenueToSave(current?: string, folder?: string): Promise<string | undefined>;
  chooseShowToOpen(folder?: string): Promise<string | undefined>;
  chooseShowToSave(current?: string, folder?: string): Promise<string | undefined>;
  chooseLibraryToOpen(folder?: string): Promise<string | undefined>;
  chooseLibraryToSave(name: string, folder?: string): Promise<string | undefined>;
  // Reveals a Profile Library backup in Explorer. Main ignores any path
  // outside the backups folder.
  showLibraryBackup(path: string): void;
}

// IPC channels guarding the window against closing with unsaved changes.
// The renderer reports each document's unsaved state; on close, main may ask
// it to save them one by one, waiting for each reply on the saved channel.
export const UNSAVED_CHANNEL = 'window:unsaved';
export const SAVE_BEFORE_CLOSE_CHANNEL = 'window:saveBeforeClose';
export const SAVED_BEFORE_CLOSE_CHANNEL = 'window:savedBeforeClose';

// The documents that can have unsaved changes, in the order they are saved.
export const DOCUMENTS = { show: 'Show', venue: 'Venue Patch', profile: 'Profile' } as const;
export type DocumentKind = keyof typeof DOCUMENTS;

// Whether a value from the renderer names a document. Inherited keys such as
// `toString` do not count.
export function isDocumentKind(value: unknown): value is DocumentKind {
  return typeof value === 'string' && Object.hasOwn(DOCUMENTS, value);
}

// "The Show, the Venue Patch and the Profile have unsaved changes."
export function unsavedMessage(documents: readonly DocumentKind[]): string {
  const names = documents.map((d) => `the ${DOCUMENTS[d]}`);
  const last = names.pop();
  const list = names.length > 0 ? `${names.join(', ')} and ${last}` : (last ?? '');
  const verb = documents.length > 1 ? 'have' : 'has';
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} ${verb} unsaved changes.`;
}

// What the preload script exposes to the renderer as `window.closeGuard`.
export interface CloseGuardBridge {
  setUnsaved(document: DocumentKind, unsaved: boolean): void;
  // `save` resolves to true when the document was saved. Returns an
  // unsubscribe function.
  onSaveBeforeClose(document: DocumentKind, save: () => Promise<boolean>): () => void;
}

// Engine process argument naming the Profile Library file: `<arg><path>`.
export const PROFILE_LIBRARY_ARG = '--profile-library=';

// Engine process argument naming the file that keeps the selected MIDI input
// on this machine: `<arg><path>`.
export const MIDI_INPUT_ARG = '--midi-input=';

// Engine process argument naming the file that keeps the last Venue Patch and
// Show files on this machine: `<arg><path>`.
export const RECENT_FILES_ARG = '--recent-files=';
