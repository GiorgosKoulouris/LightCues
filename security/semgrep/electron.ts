// Fixtures for electron.yml. `ruleid:` marks the next line as a finding,
// `ok:` as clean. Not compiled or linted. App-wide guards cover the whole
// file, so they have their own: electron.app-guard.ts.

import { BrowserWindow, contextBridge, ipcMain, ipcRenderer, shell } from 'electron';
import * as electron from 'electron';

// --- webPreferences ---------------------------------------------------------

// Options objects, so the window rule stays out of the way.
// ruleid: electron-node-integration-on
const nodeIntegration = { webPreferences: { preload, nodeIntegration: true } };
// ruleid: electron-context-isolation-off
const contextIsolation = { webPreferences: { contextIsolation: false } };
// ruleid: electron-sandbox-off
const sandbox = { width: 800, webPreferences: { sandbox: false } };
// ruleid: electron-web-security-off
const webSecurity = { webPreferences: { webSecurity: false } };
// ruleid: electron-insecure-content-allowed
const insecureContent = { webPreferences: { allowRunningInsecureContent: true } };
// ok: electron-node-integration-on, electron-context-isolation-off, electron-sandbox-off, electron-web-security-off, electron-insecure-content-allowed
const secure = {
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
  },
};
// ok: electron-sandbox-off
const notWebPreferences = { sandbox: false };

function preferencesInVariables(): void {
  // ruleid: electron-node-integration-on
  const prefs = { preload, nodeIntegration: true };
  const sandboxOff = { sandbox: false };
  // ruleid: electron-sandbox-off
  const options = { webPreferences: sandboxOff };
}

function windowOpenOverride(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    // ruleid: electron-sandbox-off
    overrideBrowserWindowOptions: { webPreferences: { sandbox: false } },
  }));
}

// --- shell.openExternal -----------------------------------------------------

function openLinks(url: string, host: string): void {
  // ruleid: electron-open-external-non-literal
  void shell.openExternal(url);
  // ruleid: electron-open-external-non-literal
  void shell.openExternal(`https://${host}/help`);
  // ruleid: electron-open-external-non-literal
  void electron.shell.openExternal(url, { activate: true });
  // ok: electron-open-external-non-literal
  void shell.openExternal('https://example.com/help');
  // ok: electron-open-external-non-literal
  void shell.openExternal(`https://example.com/help`);
  // ok: electron-open-external-non-literal
  shell.showItemInFolder(url);
}

// --- IPC payloads -----------------------------------------------------------

// ruleid: electron-ipc-unvalidated-payload
ipcMain.handle('open', async (_event, folder?: string) => {
  return existsSync(folder);
});

// ruleid: electron-ipc-unvalidated-payload
ipcMain.on('remove', (_event, path) => rmSync(path));

// ruleid: electron-ipc-unvalidated-payload
ipcMain.once('copy', function (_event, from: string, to: string) {
  if (typeof from !== 'string') return;
  copyFileSync(from, to);
});

// ruleid: electron-ipc-unvalidated-payload
ipcMain.on('truthy', (_event, path: unknown) => {
  if (path) shell.showItemInFolder(path);
});

// ruleid: electron-ipc-unvalidated-payload
ipcMain.on('exists', (_event, path: string) => {
  if (existsSync(path)) rmSync(path);
});

// ruleid: electron-ipc-unvalidated-payload
ipcMain.on('present', (_event, path?: string) => {
  if (path === undefined) return;
  rmSync(path);
});

// ruleid: electron-ipc-unvalidated-payload
ipcMain.on('no-exit', (_event, path: unknown) => {
  if (typeof path !== 'string') log('not a string');
  rmSync(path);
});

// ruleid: electron-ipc-unvalidated-payload
ipcMain.on('destructured', (_event, { path }) => rmSync(path));

// ruleid: electron-ipc-unvalidated-payload
ipcMain.on('iterate', (_event, paths: string[]) => {
  for (const path of paths) rmSync(path);
});

// ruleid: electron-ipc-unvalidated-payload
window.webContents.ipc.handle('scoped', (_event, path: string) => readFileSync(path));

// ok: electron-ipc-unvalidated-payload
ipcMain.on('reveal', (_event, path: unknown) => {
  if (typeof path !== 'string' || dirname(resolve(path)) !== backups) return;
  shell.showItemInFolder(path);
});

// ok: electron-ipc-unvalidated-payload
ipcMain.handle('volume', (_event, level: unknown) => {
  if (typeof level === 'number' && level >= 0 && level <= 1) setVolume(level);
});

// ok: electron-ipc-unvalidated-payload
ipcMain.handle('list', (_event, items: unknown) => {
  if (!Array.isArray(items)) return;
  return items.length;
});

// ok: electron-ipc-unvalidated-payload
ipcMain.handle('kind', (_event, kind: unknown) => {
  if (kind !== 'show' && kind !== 'venue') return;
  return load(kind);
});

// ok: electron-ipc-unvalidated-payload
ipcMain.handle('allowed', (_event, kind: unknown) => {
  if (!KINDS.includes(kind)) throw new Error('Unknown kind');
  return load(kind);
});

// ok: electron-ipc-unvalidated-payload
ipcMain.handle('custom', (_event, venue: unknown) => {
  if (!isVenue(venue)) {
    log('bad venue');
    return;
  }
  save(venue);
});

// ok: electron-ipc-unvalidated-payload
ipcMain.handle('settings', (_event, raw: unknown) => {
  const settings = SettingsSchema.parse(raw);
  save(settings);
});

// ok: electron-ipc-unvalidated-payload
ipcMain.on('saved', (_event, saved: boolean) => {
  if (!saved) return;
  state = saved ? 'saved' : 'unsaved';
});

// ok: electron-ipc-unvalidated-payload
ipcMain.handle('ping', (_event, _unused: unknown) => 'pong');

// ok: electron-ipc-unvalidated-payload
ipcMain.removeListener('remove', (_event, path) => rmSync(path));

function namedHandlers(contents: WebContents): void {
  // ruleid: electron-ipc-unvalidated-payload
  function onUnsaved(event: IpcMainEvent, document: string): void {
    if (event.sender !== contents) return;
    unsaved.add(document);
  }
  // ok: electron-ipc-unvalidated-payload
  function onSaved(event: IpcMainEvent, document: unknown): void {
    if (event.sender !== contents || typeof document !== 'string') return;
    unsaved.delete(document);
  }
  // ruleid: electron-ipc-unvalidated-payload
  const onClosed = (_event: IpcMainEvent, document: string) => unsaved.delete(document);
  // ok: electron-ipc-unvalidated-payload
  function notAHandler(event: unknown, document: string): void {
    unsaved.add(document);
  }
  ipcMain.on('unsaved', onUnsaved);
  ipcMain.on('saved', onSaved);
  ipcMain.on('closed', onClosed);
  notAHandler(undefined, 'show');
}

function handlersDeclaredLater(): void {
  ipcMain.on('opened', onOpened);
  ipcMain.on('renamed', onRenamed);

  // ruleid: electron-ipc-unvalidated-payload
  function onOpened(_event: IpcMainEvent, path: string): void {
    recent.add(path);
  }
  // ok: electron-ipc-unvalidated-payload
  function onRenamed(_event: IpcMainEvent, name: unknown): void {
    if (typeof name !== 'string') return;
    rename(name);
  }
}

// --- contextBridge ----------------------------------------------------------

// ruleid: electron-expose-ipc-renderer
contextBridge.exposeInMainWorld('ipc', ipcRenderer);
// ruleid: electron-expose-ipc-renderer
contextBridge.exposeInMainWorld('ipc', { ipcRenderer });
// ruleid: electron-expose-ipc-renderer
contextBridge.exposeInMainWorld('ipc', { invoke: ipcRenderer.invoke });
contextBridge.exposeInMainWorld('ipc', {
  // ruleid: electron-expose-ipc-renderer
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
});
contextBridge.exposeInMainWorld('ipc', {
  send(channel: string, data: unknown) {
    // ruleid: electron-expose-ipc-renderer
    ipcRenderer.send(channel, data);
  },
});

const forwarder: Api = {
  // ruleid: electron-expose-ipc-renderer
  on: (channel: string, listener: Listener) => ipcRenderer.on(channel, listener),
  // ruleid: electron-expose-ipc-renderer
  invoke: ipcRenderer.invoke.bind(ipcRenderer),
  // ruleid: electron-expose-ipc-renderer
  call: (...args: Parameters<typeof ipcRenderer.invoke>) => ipcRenderer.invoke(...args),
  // ruleid: electron-expose-ipc-renderer
  onUpdate: (listener: Listener) => ipcRenderer.on('update', listener),
};
contextBridge.exposeInMainWorld('forwarder', forwarder);

const dialogs: DialogBridge = {
  // ok: electron-expose-ipc-renderer
  chooseShowToOpen: (folder) => ipcRenderer.invoke(CHOOSE_SHOW_TO_OPEN_CHANNEL, folder),
  // ok: electron-expose-ipc-renderer
  showLibraryBackup: (path) => ipcRenderer.send('show-library-backup', path),
  onUpdate(listener: (value: number) => void) {
    // ok: electron-expose-ipc-renderer
    ipcRenderer.on('update', (_event, value: number) => listener(value));
  },
};
contextBridge.exposeInMainWorld('dialogs', dialogs);

// ok: electron-expose-ipc-renderer
const internal = { invoke: (channel: string) => ipcRenderer.invoke(channel) };

// --- Navigation and new windows ---------------------------------------------

function unguardedWindow(): void {
  // ruleid: electron-missing-navigation-guards
  const window = new BrowserWindow({});
  void window.loadFile('index.html');
}

function guardedWindow(): void {
  // ok: electron-missing-navigation-guards
  const window = new BrowserWindow({});
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
}

function guardedThroughContents(): void {
  // ok: electron-missing-navigation-guards
  const window = new BrowserWindow({});
  const contents = window.webContents;
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event) => event.preventDefault());
}

function halfGuardedWindow(): void {
  // ruleid: electron-missing-navigation-guards
  const window = new BrowserWindow({});
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function guardNavigation(contents: WebContents): void {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event) => event.preventDefault());
}

function denyNewWindows(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function guardedInHelper(): void {
  // ok: electron-missing-navigation-guards
  const window = new BrowserWindow({});
  guardNavigation(window.webContents);
}

function guardedInLaterHelper(): void {
  // ok: electron-missing-navigation-guards
  const window = new BrowserWindow({});
  guardWindow(window);
}

function halfGuardedInHelper(): void {
  // ruleid: electron-missing-navigation-guards
  const window = new BrowserWindow({});
  denyNewWindows(window);
}

function guardWindow(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
}
