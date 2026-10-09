import { contextBridge, ipcRenderer } from 'electron';
import {
  CHECK_FOR_UPDATES_CHANNEL,
  CHOOSE_LIBRARY_TO_OPEN_CHANNEL,
  CHOOSE_LIBRARY_TO_SAVE_CHANNEL,
  CHOOSE_SHOW_TO_OPEN_CHANNEL,
  CHOOSE_SHOW_TO_SAVE_CHANNEL,
  CHOOSE_VENUE_TO_OPEN_CHANNEL,
  CHOOSE_VENUE_TO_SAVE_CHANNEL,
  ENGINE_PORT_CHANNEL,
  OPEN_RELEASE_PAGE_CHANNEL,
  SAVE_BEFORE_CLOSE_CHANNEL,
  SAVED_BEFORE_CLOSE_CHANNEL,
  SET_UPDATE_ENABLED_CHANNEL,
  SHOW_LIBRARY_BACKUP_CHANNEL,
  UNSAVED_CHANNEL,
  UPDATE_AVAILABLE_CHANNEL,
  UPDATE_ENABLED_CHANNEL,
  type CloseGuardBridge,
  type DialogBridge,
  type DocumentKind,
  type EngineBridge,
  type EngineCommand,
  type EngineEvent,
  type UpdatesBridge,
} from '../shared/protocol';

let port: MessagePort | undefined;
const pending: EngineCommand[] = [];
const listeners = new Set<(event: EngineEvent) => void>();

// Main sends the engine port after the page loads; queue commands until then.
ipcRenderer.on(ENGINE_PORT_CHANNEL, (event) => {
  port = event.ports[0];
  if (!port) return;
  port.onmessage = (message: MessageEvent<EngineEvent>) => {
    listeners.forEach((listener) => listener(message.data));
  };
  pending.splice(0).forEach((command) => port?.postMessage(command));
});

const bridge: EngineBridge = {
  send(command) {
    if (port) port.postMessage(command);
    else pending.push(command);
  },
  onEvent(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

contextBridge.exposeInMainWorld('engine', bridge);

const dialogs: DialogBridge = {
  chooseVenueToOpen: (folder) => ipcRenderer.invoke(CHOOSE_VENUE_TO_OPEN_CHANNEL, folder),
  chooseVenueToSave: (current, folder) =>
    ipcRenderer.invoke(CHOOSE_VENUE_TO_SAVE_CHANNEL, current, folder),
  chooseShowToOpen: (folder) => ipcRenderer.invoke(CHOOSE_SHOW_TO_OPEN_CHANNEL, folder),
  chooseShowToSave: (current, folder) =>
    ipcRenderer.invoke(CHOOSE_SHOW_TO_SAVE_CHANNEL, current, folder),
  chooseLibraryToOpen: (folder) => ipcRenderer.invoke(CHOOSE_LIBRARY_TO_OPEN_CHANNEL, folder),
  chooseLibraryToSave: (name, folder) =>
    ipcRenderer.invoke(CHOOSE_LIBRARY_TO_SAVE_CHANNEL, undefined, folder, name),
  showLibraryBackup: (path) => ipcRenderer.send(SHOW_LIBRARY_BACKUP_CHANNEL, path),
};

contextBridge.exposeInMainWorld('dialogs', dialogs);

const closeGuard: CloseGuardBridge = {
  setUnsaved: (document, unsaved) => ipcRenderer.send(UNSAVED_CHANNEL, document, unsaved),
  onSaveBeforeClose(document, save) {
    const listener = (_event: unknown, asked: DocumentKind) => {
      if (asked !== document) return;
      void save()
        .catch(() => false)
        .then((saved) => ipcRenderer.send(SAVED_BEFORE_CLOSE_CHANNEL, document, saved));
    };
    ipcRenderer.on(SAVE_BEFORE_CLOSE_CHANNEL, listener);
    return () => ipcRenderer.removeListener(SAVE_BEFORE_CLOSE_CHANNEL, listener);
  },
};

contextBridge.exposeInMainWorld('closeGuard', closeGuard);

const updates: UpdatesBridge = {
  available: () => ipcRenderer.invoke(UPDATE_AVAILABLE_CHANNEL),
  enabled: () => ipcRenderer.invoke(UPDATE_ENABLED_CHANNEL),
  setEnabled: (enabled) => ipcRenderer.send(SET_UPDATE_ENABLED_CHANNEL, enabled),
  checkNow: () => ipcRenderer.invoke(CHECK_FOR_UPDATES_CHANNEL),
  openReleasePage: (url) => ipcRenderer.send(OPEN_RELEASE_PAGE_CHANNEL, url),
};

contextBridge.exposeInMainWorld('updates', updates);
