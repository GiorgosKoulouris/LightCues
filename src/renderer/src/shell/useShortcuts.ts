import { useEffect, useRef } from 'react';
import { appShortcut, type AppAction, type FileCommand, type HistoryCommand } from './shortcuts';
import type { View } from './views';

export type FileCommands = Record<FileCommand, () => void>;
export type HistoryCommands = Record<HistoryCommand, () => void>;

// Switches view on Ctrl+1 to 4, from anywhere, also while typing.
export function useViewShortcuts(setView: (view: View) => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = appShortcut(event);
      if (action?.type !== 'view') return;
      event.preventDefault();
      setView(action.view);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setView]);
}

// Runs a view's file commands on Ctrl+N, O, S and Shift+S while the view is
// `active`. Undefined while the view is loading.
export function useFileShortcuts(active: boolean, commands: FileCommands | undefined): void {
  useAppShortcut(active, (action) => {
    if (action.type !== 'file' || !commands) return false;
    // Commits a field that commits on blur, so Save takes what was typed.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    commands[action.command]();
    return true;
  });
}

// Runs `find` on Ctrl+F while `active`, also while typing. `find` focuses the
// current list's search.
export function useFindShortcut(active: boolean, find: () => void): void {
  useAppShortcut(active, (action) => {
    if (action.type !== 'find') return false;
    find();
    return true;
  });
}

// Runs Undo and Redo on Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y while `active`, also
// while typing in a field, whose valid text is already committed. A field with
// invalid text, a search box and a modal dialog keep the browser's own undo.
export function useHistoryShortcuts(active: boolean, commands: HistoryCommands): void {
  useAppShortcut(active, (action, event) => {
    if (action.type !== 'history') return false;
    const target = event.target instanceof Element ? event.target : null;
    const native = 'input[type="search"], [aria-invalid="true"], [aria-modal="true"] *';
    if (target?.matches(native)) return false;
    // Settles the field's text, so the undone value replaces it.
    if (target instanceof HTMLInputElement) {
      target.blur();
      target.focus();
    }
    commands[action.command]();
    return true;
  });
}

// Calls `handle` with each app shortcut pressed while `active`. It returns
// whether it took the shortcut, and may be a new function on each render.
function useAppShortcut(
  active: boolean,
  handle: (action: AppAction, event: KeyboardEvent) => boolean,
): void {
  const latest = useRef(handle);
  useEffect(() => {
    latest.current = handle;
  });

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const action = appShortcut(event);
      if (action && latest.current(action, event)) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active]);
}
