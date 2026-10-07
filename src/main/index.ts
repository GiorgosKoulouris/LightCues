import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  MessageChannelMain,
  utilityProcess,
  type IpcMainEvent,
  type UtilityProcess,
} from 'electron';
import { join } from 'node:path';
import {
  CHOOSE_VENUE_TO_OPEN_CHANNEL,
  CHOOSE_VENUE_TO_SAVE_CHANNEL,
  ENGINE_PORT_CHANNEL,
  PROFILE_LIBRARY_ARG,
  SAVE_BEFORE_CLOSE_CHANNEL,
  SAVED_BEFORE_CLOSE_CHANNEL,
  UNSAVED_CHANNEL,
  type EngineConnect,
} from '../shared/protocol';

const VENUE_FILTERS = [{ name: 'LightCues Venue Patch', extensions: ['lcvenue'] }];

function startEngine(): UtilityProcess {
  const library = join(app.getPath('userData'), 'profile-library.json');
  const engine = utilityProcess.fork(
    join(__dirname, 'engine.js'),
    [PROFILE_LIBRARY_ARG + library],
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

// Native Open/Save dialogs for .lcvenue files. The engine reads and writes
// the chosen path.
function handleVenueDialogs(): void {
  ipcMain.handle(CHOOSE_VENUE_TO_OPEN_CHANNEL, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = { filters: VENUE_FILTERS, properties: ['openFile' as const] };
    const result = await (window
      ? dialog.showOpenDialog(window, options)
      : dialog.showOpenDialog(options));
    return result.canceled ? undefined : result.filePaths[0];
  });
  ipcMain.handle(CHOOSE_VENUE_TO_SAVE_CHANNEL, async (event, current?: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = { filters: VENUE_FILTERS, defaultPath: current };
    const result = await (window
      ? dialog.showSaveDialog(window, options)
      : dialog.showSaveDialog(options));
    return result.canceled ? undefined : result.filePath;
  });
}

// Asks before closing a window whose Venue Patch has unsaved changes. Save
// runs the renderer's own save flow; the window closes only once it worked.
function guardClose(window: BrowserWindow): void {
  const contents = window.webContents;
  let unsaved = false;
  let saving = false;
  let closing = false;

  function onUnsaved(event: IpcMainEvent, value: boolean): void {
    if (event.sender === contents) unsaved = value;
  }
  function onSaved(event: IpcMainEvent, saved: boolean): void {
    if (event.sender !== contents || !saving) return;
    saving = false;
    if (saved) close();
  }
  ipcMain.on(UNSAVED_CHANNEL, onUnsaved);
  ipcMain.on(SAVED_BEFORE_CLOSE_CHANNEL, onSaved);
  window.on('closed', () => {
    ipcMain.removeListener(UNSAVED_CHANNEL, onUnsaved);
    ipcMain.removeListener(SAVED_BEFORE_CLOSE_CHANNEL, onSaved);
  });
  // A reload drops a save in progress; the new page reports its own state.
  contents.on('did-start-loading', () => {
    saving = false;
  });

  function close(): void {
    closing = true;
    window.close();
  }

  window.on('close', (event) => {
    if (closing || !unsaved) return;
    event.preventDefault();
    if (saving) return;
    const choice = dialog.showMessageBoxSync(window, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: 'The Venue Patch has unsaved changes.',
      detail: 'Save them before closing?',
    });
    if (choice === 0) {
      saving = true;
      contents.send(SAVE_BEFORE_CLOSE_CHANNEL);
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
  handleVenueDialogs();
  createWindow(engine);
});

app.on('window-all-closed', () => app.quit());
