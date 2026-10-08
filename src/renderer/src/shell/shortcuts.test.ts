import { describe, expect, it } from 'vitest';
import { panelAction } from '../panel/shortcuts';
import { appShortcut, type AppKeyPress } from './shortcuts';

const press = (key: string, more: Partial<AppKeyPress> = {}): AppKeyPress => ({
  key,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  repeat: false,
  ...more,
});
const ctrl = (key: string, more: Partial<AppKeyPress> = {}) =>
  press(key, { ctrlKey: true, ...more });

describe('appShortcut', () => {
  it('switches view with Ctrl+1 to 4', () => {
    expect(appShortcut(ctrl('1'))).toEqual({ type: 'view', view: 'show' });
    expect(appShortcut(ctrl('2'))).toEqual({ type: 'view', view: 'venue' });
    expect(appShortcut(ctrl('3'))).toEqual({ type: 'view', view: 'profiles' });
    expect(appShortcut(ctrl('4'))).toEqual({ type: 'view', view: 'perform' });
  });

  it("acts on the current view's file with Ctrl+N, O, S and Shift+S", () => {
    expect(appShortcut(ctrl('n'))).toEqual({ type: 'file', command: 'new' });
    expect(appShortcut(ctrl('o'))).toEqual({ type: 'file', command: 'open' });
    expect(appShortcut(ctrl('s'))).toEqual({ type: 'file', command: 'save' });
    expect(appShortcut(ctrl('S', { shiftKey: true }))).toEqual({ type: 'file', command: 'saveAs' });
  });

  it("focuses the current list's search with Ctrl+F", () => {
    expect(appShortcut(ctrl('f'))).toEqual({ type: 'find' });
    expect(appShortcut(ctrl('F', { shiftKey: true }))).toBeUndefined();
    expect(appShortcut(press('f'))).toBeUndefined();
  });

  it('undoes with Ctrl+Z and redoes with Ctrl+Shift+Z or Ctrl+Y, also held', () => {
    expect(appShortcut(ctrl('z'))).toEqual({ type: 'history', command: 'undo' });
    expect(appShortcut(ctrl('Z', { shiftKey: true }))).toEqual({
      type: 'history',
      command: 'redo',
    });
    expect(appShortcut(ctrl('y'))).toEqual({ type: 'history', command: 'redo' });
    expect(appShortcut(ctrl('z', { repeat: true }))).toEqual({ type: 'history', command: 'undo' });
    expect(appShortcut(press('z'))).toBeUndefined();
    expect(appShortcut(ctrl('y', { shiftKey: true }))).toBeUndefined();
  });

  it('ignores bare keys, held keys, Alt, Meta and other Ctrl keys', () => {
    expect(appShortcut(press('1'))).toBeUndefined();
    expect(appShortcut(press('s'))).toBeUndefined();
    expect(appShortcut(ctrl('s', { repeat: true }))).toBeUndefined();
    expect(appShortcut(ctrl('1', { altKey: true }))).toBeUndefined();
    expect(appShortcut(ctrl('s', { metaKey: true }))).toBeUndefined();
    expect(appShortcut(ctrl('5'))).toBeUndefined();
    expect(appShortcut(ctrl('1', { shiftKey: true }))).toBeUndefined();
    expect(appShortcut(ctrl('n', { shiftKey: true }))).toBeUndefined();
  });

  it('never shares a key with the Fallback Panel', () => {
    const keys = [
      'b',
      'B',
      '0',
      '1',
      '2',
      '3',
      '9',
      '-',
      '+',
      '=',
      'n',
      'o',
      's',
      'S',
      'f',
      'z',
      'Z',
      'y',
    ];
    for (const key of keys) {
      for (const ctrlKey of [false, true]) {
        for (const shiftKey of [false, true]) {
          const keyPress = press(key, { ctrlKey, shiftKey });
          const both = appShortcut(keyPress) !== undefined && panelAction(keyPress) !== undefined;
          expect(both, `${key} ctrl=${ctrlKey} shift=${shiftKey}`).toBe(false);
        }
      }
    }
  });
});
