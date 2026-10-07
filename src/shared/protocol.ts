// The typed message contract between the UI and the engine process.
// The UI sends EngineCommands; the engine sends EngineEvents.
import type { FixtureProfile, UnsupportedFeature } from './fixture-profile';
import type { Layer, Scene, Show } from './show';
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
  // `replaces` is the id of the Profile being edited; absent for a new one.
  | { type: 'saveProfile'; requestId: number; profile: FixtureProfile; replaces?: string }
  | { type: 'deleteProfile'; id: string }
  // The current Venue Patch. `path` is an .lcvenue file; `saveVenue` without
  // one saves to the file the patch was opened from or last saved to.
  | { type: 'getVenue' }
  | { type: 'newVenue' }
  | { type: 'openVenue'; requestId: number; path: string }
  | { type: 'saveVenue'; requestId: number; path?: string }
  | { type: 'editVenue'; requestId: number; edit: VenueEdit }
  | { type: 'listOutputs' }
  // The current Show, handled like the Venue Patch. `path` is an .lcshow file.
  | { type: 'getShow' }
  | { type: 'newShow' }
  | { type: 'openShow'; requestId: number; path: string }
  | { type: 'saveShow'; requestId: number; path?: string }
  | { type: 'editShow'; requestId: number; edit: ShowEdit }
  // Active Scenes and the mode. `goScene` replaces the active Scene in its
  // Layer, fading in; `clearLayer` clears it at once.
  | { type: 'getPlayback' }
  | { type: 'goScene'; sceneId: string }
  | { type: 'clearLayer'; layerId: string }
  | { type: 'setMode'; mode: PlaybackMode };

// Monitor sends the active Scenes to the Outputs. Blind holds the Outputs at
// the frames sent last.
export type PlaybackMode = 'monitor' | 'blind';

// The active Scene id per Layer id. A Layer without an entry is clear.
export type ActiveByLayer = Record<string, string>;

// A change to the current Show.
export type ShowEdit =
  | { type: 'putScene'; scene: Scene }
  | { type: 'removeScene'; id: string }
  | { type: 'putLayer'; layer: Layer }
  // Removes the Layer's Scenes too.
  | { type: 'removeLayer'; id: string }
  | { type: 'setBaseLook'; sceneId?: string };

// A change to the current Venue Patch. `putFixture` embeds the Fixture's
// Profile from the Profile Library when the patch does not have it yet.
export type VenueEdit =
  | { type: 'setStage'; stage: StageBounds }
  // `addUniverse` rejects a number already in the patch; `putUniverse`
  // replaces that Universe.
  | { type: 'addUniverse'; universe: Universe }
  | { type: 'putUniverse'; universe: Universe }
  | { type: 'removeUniverse'; number: number }
  | { type: 'putFixture'; fixture: PatchedFixture }
  | { type: 'moveFixture'; id: string; position: StagePosition }
  | { type: 'removeFixture'; id: string };

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

export interface ProfileLibraryEntry {
  profile: FixtureProfile;
  handEdited: boolean;
}

export type OflImportResult =
  | { status: 'imported'; profileId: string; unsupported: UnsupportedFeature[] }
  | { status: 'conflict'; profileId: string }
  | { status: 'failed'; error: string };

export type EngineEvent =
  | { type: 'pong'; id: number; uptimeMs: number }
  // The whole Profile Library, sent on request and after every change.
  | { type: 'profiles'; entries: ProfileLibraryEntry[] }
  | { type: 'oflImported'; requestId: number; result: OflImportResult }
  // An empty `errors` list means the Profile was saved.
  | { type: 'profileSaved'; requestId: number; errors: string[] }
  // The current Venue Patch, sent on request and after every change. `unsaved`
  // is true when it has changes not yet written to a file.
  | { type: 'venue'; patch: VenuePatch; path?: string; unsaved: boolean }
  // Reply to openVenue, saveVenue and editVenue. An empty `errors` list means
  // it was done.
  | { type: 'venueDone'; requestId: number; errors: string[] }
  // All Outputs, sent on request and after every change.
  | { type: 'outputs'; outputs: OutputStatus[] }
  // The current Show, sent on request and after every change.
  | { type: 'show'; show: Show; path?: string; unsaved: boolean }
  // Reply to openShow, saveShow and editShow. An empty `errors` list means it
  // was done.
  | { type: 'showDone'; requestId: number; errors: string[] }
  // The active Scenes and the mode. Sent on request and after every change.
  | { type: 'playback'; active: ActiveByLayer; mode: PlaybackMode };

// Sent by the main process to the engine with a fresh UI MessagePort attached.
export type EngineConnect = { type: 'connect' };

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

// What the preload script exposes to the renderer as `window.dialogs`. Each
// resolves to the chosen path, or undefined when the user cancels.
export interface DialogBridge {
  chooseVenueToOpen(): Promise<string | undefined>;
  chooseVenueToSave(current?: string): Promise<string | undefined>;
  chooseShowToOpen(): Promise<string | undefined>;
  chooseShowToSave(current?: string): Promise<string | undefined>;
}

// IPC channels guarding the window against closing with unsaved changes.
// The renderer reports each document's unsaved state; on close, main may ask
// it to save them one by one, waiting for each reply on the saved channel.
export const UNSAVED_CHANNEL = 'window:unsaved';
export const SAVE_BEFORE_CLOSE_CHANNEL = 'window:saveBeforeClose';
export const SAVED_BEFORE_CLOSE_CHANNEL = 'window:savedBeforeClose';

// The documents that can have unsaved changes, in the order they are saved.
export const DOCUMENTS = { show: 'Show', venue: 'Venue Patch' } as const;
export type DocumentKind = keyof typeof DOCUMENTS;

// What the preload script exposes to the renderer as `window.closeGuard`.
export interface CloseGuardBridge {
  setUnsaved(document: DocumentKind, unsaved: boolean): void;
  // `save` resolves to true when the document was saved. Returns an
  // unsubscribe function.
  onSaveBeforeClose(document: DocumentKind, save: () => Promise<boolean>): () => void;
}

// Engine process argument naming the Profile Library file: `<arg><path>`.
export const PROFILE_LIBRARY_ARG = '--profile-library=';
