// The typed message contract between the UI and the engine process.
// The UI sends EngineCommands; the engine sends EngineEvents.
import type { FixtureProfile, UnsupportedFeature } from './fixture-profile';
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
  | { type: 'editVenue'; requestId: number; edit: VenueEdit };

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
  | { type: 'venueDone'; requestId: number; errors: string[] };

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

// What the preload script exposes to the renderer as `window.dialogs`. Each
// resolves to the chosen path, or undefined when the user cancels.
export interface DialogBridge {
  chooseVenueToOpen(): Promise<string | undefined>;
  chooseVenueToSave(current?: string): Promise<string | undefined>;
}

// IPC channels guarding the window against closing with unsaved changes.
// The renderer reports its unsaved state; on close, main may ask it to save
// and waits for a reply on the saved channel.
export const UNSAVED_CHANNEL = 'window:unsaved';
export const SAVE_BEFORE_CLOSE_CHANNEL = 'window:saveBeforeClose';
export const SAVED_BEFORE_CLOSE_CHANNEL = 'window:savedBeforeClose';

// What the preload script exposes to the renderer as `window.closeGuard`.
export interface CloseGuardBridge {
  setUnsaved(unsaved: boolean): void;
  // `save` resolves to true when the changes were saved. Returns an
  // unsubscribe function.
  onSaveBeforeClose(save: () => Promise<boolean>): () => void;
}

// Engine process argument naming the Profile Library file: `<arg><path>`.
export const PROFILE_LIBRARY_ARG = '--profile-library=';
