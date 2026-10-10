import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  MessageChannelMain,
  net,
  shell,
  utilityProcess,
  type FileFilter,
  type IpcMainEvent,
  type UtilityProcess,
  type WebContents,
} from 'electron';
import { existsSync } from 'node:fs';
import { release } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { format } from 'node:util';
import {
  APP_INFO_CHANNEL,
  CHECK_FOR_UPDATES_CHANNEL,
  CHOOSE_LIBRARY_TO_OPEN_CHANNEL,
  CHOOSE_LIBRARY_TO_SAVE_CHANNEL,
  CHOOSE_SHOW_TO_OPEN_CHANNEL,
  CHOOSE_SHOW_TO_SAVE_CHANNEL,
  CHOOSE_VENUE_TO_OPEN_CHANNEL,
  CHOOSE_VENUE_TO_SAVE_CHANNEL,
  DOCUMENTS,
  ENGINE_DOWN_CHANNEL,
  ENGINE_IS_DOWN_CHANNEL,
  ENGINE_PORT_CHANNEL,
  ENGINE_RESTARTED_CHANNEL,
  LIBRARY_BACKUPS_FOLDER,
  MIDI_INPUT_ARG,
  OPEN_EXAMPLE_CHANNEL,
  OPEN_RELEASE_PAGE_CHANNEL,
  RECENT_FILES_ARG,
  PROFILE_LIBRARY_ARG,
  SAVE_BEFORE_CLOSE_CHANNEL,
  SAVE_FROM_SNAPSHOT_CHANNEL,
  SAVED_BEFORE_CLOSE_CHANNEL,
  SET_UPDATE_ENABLED_CHANNEL,
  SHOW_LIBRARY_BACKUP_CHANNEL,
  UNSAVED_CHANNEL,
  UPDATE_AVAILABLE_CHANNEL,
  UPDATE_ENABLED_CHANNEL,
  isDocumentKind,
  isEngineDocument,
  unsavedMessage,
  type AppInfo,
  type DocumentKind,
  type EngineConnect,
  type ExamplePaths,
  type EngineGrantPath,
  type EnginePathGranted,
  type UpdateAvailable,
} from '../shared/protocol';
import { diskShowFiles, diskVenueFiles, fileStorage } from '../engine/file-storage';
import { snapshotFile } from './engine-snapshot';
import { superviseEngine } from './engine-supervisor';
import { createLog, lineSplitter } from './log';
import { isAppPage } from './navigation';
import { createUpdateCheck, isReleasePageUrl } from './update-check';

const VENUE_FILTERS = [{ name: 'LightCues Venue Patch', extensions: ['lcvenue'] }];
const SHOW_FILTERS = [{ name: 'LightCues Show', extensions: ['lcshow'] }];
const LIBRARY_FILTERS = [{ name: 'LightCues Profile Library', extensions: ['lclibrary'] }];
// Import also takes raw library JSON, such as a backup.
const LIBRARY_OPEN_FILTERS = [{ name: 'Profile Library', extensions: ['lclibrary', 'json'] }];

// The Profile Library file. The engine keeps its backups in a folder beside it.
function libraryPath(): string {
  return join(app.getPath('userData'), 'profile-library.json');
}

// The log file, in `userData/logs`. A packaged app has no console, so this is
// the only trace of a crash at a gig. Paths may be logged; document and file
// contents may not.
const logFolder = join(app.getPath('userData'), 'logs');
const logFile = createLog(logFolder, () => new Date());

// Main's own lines go to the log file and the console, which `npm run dev`
// shows.
function logTo(echo: (...args: unknown[]) => void) {
  return (...args: unknown[]): void => {
    echo(...args);
    logFile.write(format(...args));
  };
}
const log = logTo(console.log);
const logError = logTo(console.error);

// Copies an engine output stream to the log file, line by line with an
// `[engine]` prefix, and to main's own stream.
function logEngineOutput(stream: NodeJS.ReadableStream | null, echo: NodeJS.WriteStream): void {
  if (!stream) return;
  const lines = lineSplitter((line) => logFile.write(`[engine] ${line}`));
  stream.setEncoding('utf8');
  stream.on('data', (chunk: string) => {
    echo.write(chunk);
    lines.push(chunk);
  });
  stream.on('end', () => lines.end());
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
      stdio: 'pipe',
    },
  );
  logEngineOutput(engine.stdout, process.stdout);
  logEngineOutput(engine.stderr, process.stderr);
  engine.on('spawn', () => log(`Engine started (pid ${engine.pid})`));
  engine.on('exit', (code) => logError(`Engine exited with code ${code}`));
  return engine;
}

type Supervisor = ReturnType<typeof superviseEngine<UtilityProcess>>;

// Gives the window a direct MessagePort to the engine, so UI traffic never
// passes through the main process.
function connectWindow(window: BrowserWindow, engine: UtilityProcess): void {
  const { port1, port2 } = new MessageChannelMain();
  const connect: EngineConnect = { type: 'connect' };
  engine.postMessage(connect, [port1]);
  window.webContents.postMessage(ENGINE_PORT_CHANNEL, null, [port2]);
}

// Connects the window to the current engine on every load, so reloads
// reconnect. An engine that is down gets no port.
function connectWindowToEngine(window: BrowserWindow, supervisor: Supervisor): void {
  window.webContents.on('did-finish-load', () => {
    if (!supervisor.isDown()) connectWindow(window, supervisor.current());
  });
}

// Starts the engine and restarts it after a crash (ADR 0011). A restarted
// engine reaches the window, if there is one, on a new port; the renderer
// hears how its restore went, or that the engine is down for good.
function startSupervisedEngine(window: () => BrowserWindow | undefined): Supervisor {
  const supervisor = superviseEngine({
    start: startEngine,
    now: Date.now,
    log: (message) => log(message),
    connect: (engine) => {
      const current = window();
      if (current) connectWindow(current, engine);
    },
    restarted: (result) => window()?.webContents.send(ENGINE_RESTARTED_CHANNEL, result),
    down: () => window()?.webContents.send(ENGINE_DOWN_CHANNEL),
  });
  app.on('before-quit', () => supervisor.quitting());
  ipcMain.handle(ENGINE_IS_DOWN_CHANNEL, () => supervisor.isDown());
  ipcMain.handle(SAVE_FROM_SNAPSHOT_CHANNEL, (event, document: unknown) =>
    saveFromSnapshot(supervisor, event.sender, document),
  );
  return supervisor;
}

// Saves a document from the snapshot while the engine is down: main shows
// the Save dialog and writes the file itself. Resolves to the path, or
// undefined on Cancel. Anything else from the renderer saves nothing.
async function saveFromSnapshot(
  supervisor: Supervisor,
  sender: WebContents,
  document: unknown,
): Promise<string | undefined> {
  const snapshot = supervisor.snapshot();
  if (!supervisor.isDown() || !snapshot || !isEngineDocument(document)) {
    return undefined;
  }
  const window = BrowserWindow.fromWebContents(sender);
  const options = {
    filters: document === 'show' ? SHOW_FILTERS : VENUE_FILTERS,
    defaultPath: snapshot[document].path,
  };
  const result = await (window
    ? dialog.showSaveDialog(window, options)
    : dialog.showSaveDialog(options));
  if (result.canceled || !result.filePath) return undefined;
  const files = document === 'show' ? diskShowFiles : diskVenueFiles;
  files.write(result.filePath, snapshotFile(snapshot, document));
  log(`Saved the ${DOCUMENTS[document]} from the snapshot to ${result.filePath}`);
  return result.filePath;
}

// Grants the engine a path the user picked and waits for its ack. Only then
// may the renderer have the path: its commands reach the engine on another
// port, so they could otherwise arrive before the grant.
function grantPath(supervisor: Supervisor, path: string): Promise<void> {
  const engine = supervisor.current();
  return new Promise((granted, failed) => {
    // An engine that already exited fires no `exit` again.
    if (engine.pid === undefined) return failed(new Error('The engine is not running'));
    function onMessage(message: unknown): void {
      const ack = message as EnginePathGranted | undefined;
      if (ack?.type !== 'pathGranted' || ack.path !== path) return;
      stop();
      supervisor.granted(path);
      granted();
    }
    function onExit(): void {
      stop();
      failed(new Error('The engine stopped'));
    }
    function stop(): void {
      engine.removeListener('message', onMessage);
      engine.removeListener('exit', onExit);
    }
    engine.on('message', onMessage);
    engine.on('exit', onExit);
    const grant: EngineGrantPath = { type: 'grantPath', path };
    engine.postMessage(grant);
  });
}

// Native Open/Save dialogs for one kind of file. The current engine reads and
// writes the chosen path, once granted; a restarted one is granted it again.
// Cancel grants nothing. Without a current file, Save suggests `name` in the
// folder. Open may accept more files than Save writes. Renderer values that are not strings count as absent.
function handleFileDialogs(
  supervisor: Supervisor,
  openChannel: string,
  saveChannel: string,
  filters: FileFilter[],
  openFilters = filters,
): void {
  ipcMain.handle(openChannel, async (event, folder: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = {
      filters: openFilters,
      defaultPath: existingFolder(typeof folder === 'string' ? folder : undefined),
      properties: ['openFile' as const],
    };
    const result = await (window
      ? dialog.showOpenDialog(window, options)
      : dialog.showOpenDialog(options));
    const path = result.canceled ? undefined : result.filePaths[0];
    if (path !== undefined) await grantPath(supervisor, path);
    return path;
  });
  ipcMain.handle(saveChannel, async (event, current: unknown, folder: unknown, name: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const defaultPath =
      typeof current === 'string'
        ? current
        : suggestedPath(
            typeof folder === 'string' ? folder : undefined,
            typeof name === 'string' ? name : undefined,
          );
    const options = { filters, defaultPath };
    const result = await (window
      ? dialog.showSaveDialog(window, options)
      : dialog.showSaveDialog(options));
    const path = result.canceled ? undefined : result.filePath;
    if (path !== undefined) await grantPath(supervisor, path);
    return path;
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

// The example Venue Patch and Show: in the install's resources folder
// (electron-builder `extraResources`), or the repo's `examples/` in
// development.
function examplePaths(): ExamplePaths {
  const folder = app.isPackaged
    ? join(process.resourcesPath, 'examples')
    : join(app.getAppPath(), 'examples');
  return { venue: join(folder, 'demo.lcvenue'), show: join(folder, 'demo.lcshow') };
}

// Grants the engine both example files, like a dialog's choice (ADR 0010),
// and gives the renderer their paths.
function handleOpenExample(supervisor: Supervisor): void {
  ipcMain.handle(OPEN_EXAMPLE_CHANNEL, async () => {
    const paths = examplePaths();
    await grantPath(supervisor, paths.venue);
    await grantPath(supervisor, paths.show);
    return paths;
  });
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

// Main's part of the diagnostics for a bug report. Takes no arguments, so
// there is no renderer payload to check.
function handleAppInfo(): void {
  ipcMain.handle(APP_INFO_CHANNEL, (): AppInfo => ({
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    windowsVersion: release(),
    logFolder,
  }));
}

// How long after the window's first load the update check runs, so it never
// slows the launch.
const UPDATE_CHECK_DELAY_MS = 10_000;

// Checks for a newer release once, after the window's first load, and when
// the user asks. Main makes the request, so the renderer's CSP stays closed.
// The renderer asks for the startup result, so a reload still gets it.
// Opens only this project's release pages.
function handleUpdateCheck(window: BrowserWindow): void {
  const check = createUpdateCheck({
    currentVersion: app.getVersion(),
    fetch: (url, init) => net.fetch(url, init),
    now: Date.now,
    storage: fileStorage(join(app.getPath('userData'), 'update-check.json')),
    log: (message) => logError(message),
  });
  const result = new Promise<UpdateAvailable | undefined>((done) => {
    window.webContents.once('did-finish-load', () => {
      setTimeout(() => void check.run().then(done), UPDATE_CHECK_DELAY_MS);
    });
  });
  ipcMain.handle(UPDATE_AVAILABLE_CHANNEL, () => result);
  ipcMain.handle(UPDATE_ENABLED_CHANNEL, () => check.enabled());
  ipcMain.handle(CHECK_FOR_UPDATES_CHANNEL, () => check.checkNow());
  ipcMain.on(SET_UPDATE_ENABLED_CHANNEL, (_event, enabled: unknown) => {
    if (typeof enabled === 'boolean') check.setEnabled(enabled);
  });
  ipcMain.on(OPEN_RELEASE_PAGE_CHANNEL, (_event, url: unknown) => {
    if (isReleasePageUrl(url)) void shell.openExternal(url);
  });
}

// Asks before closing a window whose Show or Venue Patch has unsaved
// changes. Save runs the renderer's own save flow for each document in turn;
// the window closes only once all of them worked. While the engine is down,
// nothing can save that way, so it only warns.
function guardClose(window: BrowserWindow, engineDown: () => boolean): void {
  const contents = window.webContents;
  const unsaved = new Set<DocumentKind>();
  // The documents still to save, the one being saved first.
  let saving: DocumentKind[] = [];
  let closing = false;

  function onUnsaved(event: IpcMainEvent, document: unknown, value: unknown): void {
    if (event.sender !== contents || !isDocumentKind(document) || typeof value !== 'boolean') {
      return;
    }
    if (value) unsaved.add(document);
    else unsaved.delete(document);
  }
  function onSaved(event: IpcMainEvent, document: unknown, saved: unknown): void {
    if (event.sender !== contents || !isDocumentKind(document) || typeof saved !== 'boolean') {
      return;
    }
    if (saving[0] !== document) return;
    saving = saved ? saving.slice(1) : [];
    if (!saved) return;
    if (saving[0]) contents.send(SAVE_BEFORE_CLOSE_CHANNEL, saving[0]);
    else closeNow();
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

  function closeNow(): void {
    closing = true;
    window.close();
  }

  window.on('close', (event) => {
    if (closing || unsaved.size === 0) return;
    event.preventDefault();
    if (saving.length > 0) return;
    const documents = (Object.keys(DOCUMENTS) as DocumentKind[]).filter((d) => unsaved.has(d));
    if (engineDown()) {
      const close = dialog.showMessageBoxSync(window, {
        type: 'warning',
        buttons: ['Close Anyway', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        message: unsavedMessage(documents),
        detail: 'The engine has stopped. Use Save Show as… and Save Venue Patch as… first.',
      });
      if (close === 0) closeNow();
      return;
    }
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
      closeNow();
    }
  });
}

function createWindow(supervisor: Supervisor, pageUrl: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    // The packaged exe carries build/icon.ico. Dev runs set it here, or show Electron's default icon.
    ...(app.isPackaged ? {} : { icon: join(__dirname, '../../build/icon.ico') }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
    },
  });
  connectWindowToEngine(window, supervisor);
  guardClose(window, supervisor.isDown);
  void window.loadURL(pageUrl);
  return window;
}

// The renderer page: the dev server in development, the built file otherwise.
function rendererUrl(): string {
  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (!app.isPackaged && devServerUrl) return devServerUrl;
  return pathToFileURL(join(__dirname, '../renderer/index.html')).href;
}

// Every window gets the preload API, so none may open new windows or leave
// the app's page. The renderer has no links or window.open; any attempt comes
// from injected content, such as a crafted Show, Venue Patch or Profile
// Library file. Runs before the first window is created.
function restrictNavigation(pageUrl: string): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (event) => {
      if (!isAppPage(event.url, pageUrl)) event.preventDefault();
    });
  });
}

// Logs main's own errors. The monitor leaves Electron's handling of an
// uncaught exception as it is.
process.on('uncaughtExceptionMonitor', (error) => logFile.write(format('Main error:', error)));
process.on('unhandledRejection', (reason) => logError('Main unhandled rejection:', reason));

log(`LightCues ${app.getVersion()} starting`);

void app.whenReady().then(() => {
  let window: BrowserWindow | undefined;
  const engine = startSupervisedEngine(() => window);
  handleFileDialogs(
    engine,
    CHOOSE_VENUE_TO_OPEN_CHANNEL,
    CHOOSE_VENUE_TO_SAVE_CHANNEL,
    VENUE_FILTERS,
  );
  handleFileDialogs(engine, CHOOSE_SHOW_TO_OPEN_CHANNEL, CHOOSE_SHOW_TO_SAVE_CHANNEL, SHOW_FILTERS);
  handleFileDialogs(
    engine,
    CHOOSE_LIBRARY_TO_OPEN_CHANNEL,
    CHOOSE_LIBRARY_TO_SAVE_CHANNEL,
    LIBRARY_FILTERS,
    LIBRARY_OPEN_FILTERS,
  );
  handleShowLibraryBackup();
  handleOpenExample(engine);
  handleAppInfo();
  const pageUrl = rendererUrl();
  restrictNavigation(pageUrl);
  window = createWindow(engine, pageUrl);
  window.on('closed', () => (window = undefined));
  handleUpdateCheck(window);
});

app.on('window-all-closed', () => app.quit());
