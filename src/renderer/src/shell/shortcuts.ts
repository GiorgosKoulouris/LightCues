// The app's keyboard shortcuts. All use Ctrl, so they never clash with the
// Fallback Panel's bare keys. Pure, so they are testable without a DOM.
import type { KeyPress } from '../panel/shortcuts';
import { VIEWS, type View } from './views';

export type FileCommand = 'new' | 'open' | 'save' | 'saveAs';

export type HistoryCommand = 'undo' | 'redo';

export type AppAction =
  | { type: 'view'; view: View }
  | { type: 'file'; command: FileCommand }
  | { type: 'history'; command: HistoryCommand }
  // Focuses the current list's search.
  | { type: 'find' };

export interface AppKeyPress extends KeyPress {
  shiftKey: boolean;
}

// The key each file command takes with Ctrl, and whether it also takes Shift.
const FILE_KEYS: Record<FileCommand, { key: string; shift: boolean }> = {
  new: { key: 'n', shift: false },
  open: { key: 'o', shift: false },
  save: { key: 's', shift: false },
  saveAs: { key: 's', shift: true },
};

const FIND_KEY = 'f';

// Ctrl+Z undoes; Ctrl+Shift+Z and the Windows Ctrl+Y redo.
const UNDO_KEY = 'z';
const REDO_KEY = 'y';

// The action a key press runs, or undefined. Held keys do not repeat, so a
// held Ctrl+S saves once, except Undo and Redo, which step on.
export function appShortcut({
  key,
  ctrlKey,
  shiftKey,
  altKey,
  metaKey,
  repeat,
}: AppKeyPress): AppAction | undefined {
  if (!ctrlKey || altKey || metaKey) return undefined;
  const lower = key.toLowerCase();
  if (lower === UNDO_KEY) return { type: 'history', command: shiftKey ? 'redo' : 'undo' };
  if (lower === REDO_KEY && !shiftKey) return { type: 'history', command: 'redo' };
  if (repeat) return undefined;
  const command = (Object.keys(FILE_KEYS) as FileCommand[]).find(
    (c) => FILE_KEYS[c].key === lower && FILE_KEYS[c].shift === shiftKey,
  );
  if (command) return { type: 'file', command };
  if (lower === FIND_KEY && !shiftKey) return { type: 'find' };
  const view = !shiftKey && /^\d$/.test(key) ? VIEWS[Number(key) - 1] : undefined;
  return view && { type: 'view', view: view.id };
}

// A file command's shortcut, as shown in tooltips.
export function fileShortcut(command: FileCommand): string {
  const { key, shift } = FILE_KEYS[command];
  return `Ctrl+${shift ? 'Shift+' : ''}${key.toUpperCase()}`;
}

export const HISTORY_SHORTCUTS: Record<HistoryCommand, string> = {
  undo: `Ctrl+${UNDO_KEY.toUpperCase()}`,
  redo: `Ctrl+Shift+${UNDO_KEY.toUpperCase()} or Ctrl+${REDO_KEY.toUpperCase()}`,
};

export const FIND_SHORTCUT = `Ctrl+${FIND_KEY.toUpperCase()}`;

// A view's shortcut, as shown in tooltips.
export function viewShortcut(view: View): string {
  return `Ctrl+${VIEWS.findIndex((v) => v.id === view) + 1}`;
}
