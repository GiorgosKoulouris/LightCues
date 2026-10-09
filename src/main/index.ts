import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  MessageChannelMain,
  shell,
  utilityProcess,
  type FileFilter,
  type IpcMainEvent,
  type UtilityProcess,
} from 'electron';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  CHOOSE_LIBRARY_TO_OPEN_CHANNEL,
  CHOOSE_LIBRARY_TO_SAVE_CHANNEL,
  CHOOSE_SHOW_TO_OPEN_CHANNEL,
  CHOOSE_SHOW_TO_SAVE_CHANNEL,
  CHOOSE_VENUE_TO_OPEN_CHANNEL,
  CHOOSE_VENUE_TO_SAVE_CHANNEL,
  DOCUMENTS,
  ENGINE_PORT_CHANNEL,
  LIBRARY_BACKUPS_FOLDER,
  MIDI_INPUT_ARG,
  RECENT_FILES_ARG,
  PROFILE_LIBRARY_ARG,
  SAVE_BEFORE_CLOSE_CHANNEL,
  SAVED_BEFORE_CLOSE_CHANNEL,
  SHOW_LIBRARY_BACKUP_CHANNEL,
  UNSAVED_CHANNEL,
  unsavedMessage,
  type DocumentKind,
  type EngineConnect,
} from '../shared/protocol';

const VENUE_FILTERS = [{ name: 'LightCues Venue Patch', extensions: ['lcvenue'] }];
const SHOW_FILTERS = [{ name: 'LightCues Show', extensions: ['lcshow'] }];
const LIBRARY_FILTERS = [{ name: 'LightCues Profile Library', extensions: ['lclibrary'] }];
// Import also takes raw library JSON, such as a backup.
const LIBRARY_OPEN_FILTERS = [{ name: 'Profile Library', extensions: ['lclibrary', 'json'] }];

// The Profile Library file. The engine keeps its backups in a folder beside it.
function libraryPath(): string {
  return join(app.getPath('userData'), 'profile-library.json');
}

function startEngine(): UtilityProcess {
  const userData = app.getPath('userData');
  const engine = utilityProcess.fork(
    join(__dirname, 'engine.js'),
    [
      PROFILE_LIBRARY_ARG + libraryPath(),
      MIDI_INPUT_ARG + join(userData, 'midi-input.json'),
      RECENT_FILES_ARG + join(userData, 'recent-files.json'),
    ],
    {
      serviceName: 'LightCues Engine',
    },
  );
  engine.on('spawn', () => console.log(`Engine started (pid ${engine.pid})`));
  engine.on('exit', (code) => console.error(`Engine exited with code ${code}`));
  return engine;
}

// Gives the window a direct MessagePort to the engine, so UI traffic never
// passes through the main process. Runs on every load, so reloads reconnect.
function connectWindowToEngine(window: BrowserWindow, engine: UtilityProcess): void {
  window.webContents.on('did-finish-load', () => {
    const { port1, port2 } = new MessageChannelMain();
    const connect: EngineConnect = { type: 'connect' };
    engine.postMessage(connect, [port1]);
    window.webContents.postMessage(ENGINE_PORT_CHANNEL, null, [port2]);
  });
}

// Native Open/Save dialogs for one kind of file. The engine reads and writes
// the chosen path. Without a current file, Save suggests `name` in the
// folder. Open may accept more files than Save writes.
function handleFileDialogs(
  openChannel: string,
  saveChannel: string,
  filters: FileFilter[],
  openFilters = filters,
): void {
  ipcMain.handle(openChannel, async (event, folder?: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = {
      filters: openFilters,
      defaultPath: existingFolder(folder),
      properties: ['openFile' as const],
    };
    const result = await (window
      ? dialog.showOpenDialog(window, options)
      : dialog.showOpenDialog(options));
    return result.canceled ? undefined : result.filePaths[0];
  });
  ipcMain.handle(saveChannel, async (event, current?: string, folder?: string, name?: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = { filters, defaultPath: current ?? suggestedPath(folder, name) };
    const result = await (window
      ? dialog.showSaveDialog(window, options)
      : dialog.showSaveDialog(options));
    return result.canceled ? undefined : result.filePath;
  });
}

// A remembered folder that is gone falls back to the OS default.
function existingFolder(folder: string | undefined): string | undefined {
  return folder !== undefined && existsSync(folder) ? folder : undefined;
}

// `name` in the folder, or the folder alone. A name alone starts in the OS
// default folder.
function suggestedPath(folder: string | undefined, name: string | undefined): string | undefined {
  const existing = existingFolder(folder);
  if (name === undefined) return existing;
  return existing === undefined ? name : join(existing, name);
}

// Reveals a library backup in Explorer. Only files in the backups folder, so
// the renderer cannot reveal arbitrary paths.
function handleShowLibraryBackup(): void {
  const backups = join(dirname(libraryPath()), LIBRARY_BACKUPS_FOLDER);
  ipcMain.on(SHOW_LIBRARY_BACKUP_CHANNEL, (_event, path: unknown) => {
    if (typeof path !== 'string' || dirname(resolve(path)) !== backups) return;
    shell.showItemInFolder(path);
  });
}

// Asks before closing a window whose Show or Venue Patch has unsaved
// changes. Save runs the renderer's own save flow for each document in turn;
// the window closes only once all of them worked.
function guardClose(window: BrowserWindow): void {
  const contents = window.webContents;
  const unsaved = new Set<DocumentKind>();
  // The documents still to save, the one being saved first.
  let saving: DocumentKind[] = [];
  let closing = false;

  function onUnsaved(event: IpcMainEvent, document: DocumentKind, value: boolean): void {
    if (event.sender !== contents) return;
    if (value) unsaved.add(document);
    else unsaved.delete(document);
  }
  function onSaved(event: IpcMainEvent, document: DocumentKind, saved: boolean): void {
    if (event.sender !== contents || saving[0] !== document) return;
    saving = saved ? saving.slice(1) : [];
    if (!saved) return;
    if (saving[0]) contents.send(SAVE_BEFORE_CLOSE_CHANNEL, saving[0]);
    else close();
  }
  ipcMain.on(UNSAVED_CHANNEL, onUnsaved);
  ipcMain.on(SAVED_BEFORE_CLOSE_CHANNEL, onSaved);
  window.on('closed', () => {
    ipcMain.removeListener(UNSAVED_CHANNEL, onUnsaved);
    ipcMain.removeListener(SAVED_BEFORE_CLOSE_CHANNEL, onSaved);
  });
  // A reload drops a save in progress and the documents' state; the new page
  // reports its own.
  contents.on('did-start-loading', () => {
    saving = [];
    unsaved.clear();
  });

  function close(): void {
    closing = true;
    window.close();
  }

  window.on('close', (event) => {
    if (closing || unsaved.size === 0) return;
    event.preventDefault();
    if (saving.length > 0) return;
    const documents = (Object.keys(DOCUMENTS) as DocumentKind[]).filter((d) => unsaved.has(d));
    const choice = dialog.showMessageBoxSync(window, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: unsavedMessage(documents),
      detail: 'Save them before closing?',
    });
    if (choice === 0) {
      saving = documents;
      contents.send(SAVE_BEFORE_CLOSE_CHANNEL, documents[0]);
    } else if (choice === 1) {
      close();
    }
  });
}

function createWindow(engine: UtilityProcess): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
    },
  });
  connectWindowToEngine(window, engine);
  guardClose(window);

  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (!app.isPackaged && devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(() => {
  const engine = startEngine();
  handleFileDialogs(CHOOSE_VENUE_TO_OPEN_CHANNEL, CHOOSE_VENUE_TO_SAVE_CHANNEL, VENUE_FILTERS);
  handleFileDialogs(CHOOSE_SHOW_TO_OPEN_CHANNEL, CHOOSE_SHOW_TO_SAVE_CHANNEL, SHOW_FILTERS);
  handleFileDialogs(
    CHOOSE_LIBRARY_TO_OPEN_CHANNEL,
    CHOOSE_LIBRARY_TO_SAVE_CHANNEL,
    LIBRARY_FILTERS,
    LIBRARY_OPEN_FILTERS,
  );
  handleShowLibraryBackup();
  createWindow(engine);
});

app.on('window-all-closed', () => app.quit());
