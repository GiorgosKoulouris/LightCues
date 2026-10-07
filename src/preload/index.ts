import { contextBridge, ipcRenderer } from 'electron';
import {
  CHOOSE_VENUE_TO_OPEN_CHANNEL,
  CHOOSE_VENUE_TO_SAVE_CHANNEL,
  ENGINE_PORT_CHANNEL,
  SAVE_BEFORE_CLOSE_CHANNEL,
  SAVED_BEFORE_CLOSE_CHANNEL,
  UNSAVED_CHANNEL,
  type CloseGuardBridge,
  type DialogBridge,
  type EngineBridge,
  type EngineCommand,
  type EngineEvent,
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
  chooseVenueToOpen: () => ipcRenderer.invoke(CHOOSE_VENUE_TO_OPEN_CHANNEL),
  chooseVenueToSave: (current) => ipcRenderer.invoke(CHOOSE_VENUE_TO_SAVE_CHANNEL, current),
};

contextBridge.exposeInMainWorld('dialogs', dialogs);

const closeGuard: CloseGuardBridge = {
  setUnsaved: (unsaved) => ipcRenderer.send(UNSAVED_CHANNEL, unsaved),
  onSaveBeforeClose(save) {
    const listener = () => {
      void save()
        .catch(() => false)
        .then((saved) => ipcRenderer.send(SAVED_BEFORE_CLOSE_CHANNEL, saved));
    };
    ipcRenderer.on(SAVE_BEFORE_CLOSE_CHANNEL, listener);
    return () => ipcRenderer.removeListener(SAVE_BEFORE_CLOSE_CHANNEL, listener);
  },
};

contextBridge.exposeInMainWorld('closeGuard', closeGuard);
