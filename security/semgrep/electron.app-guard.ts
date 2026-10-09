// Fixtures for electron.yml: one guard for all windows, in
// `app.on('web-contents-created', …)`. It covers every window in the file,
// so these cases can't share electron.ts. Not compiled or linted.
//
// No annotations: semgrep --test rejects a file with only `ok:` lines for a
// rule, and fails on any finding in a file without annotations.

import { app, BrowserWindow } from 'electron';

function createWindow(): void {
  // Clean: the app-wide guard below covers this window.
  const window = new BrowserWindow({});
  void window.loadFile('index.html');
}

void app.whenReady().then(() => {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (event) => event.preventDefault());
  });
  createWindow();
});
