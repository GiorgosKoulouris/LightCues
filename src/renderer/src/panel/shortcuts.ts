// The Fallback Panel's keyboard shortcuts. Pure, so they are testable without
// a DOM.
import { MAX_PANEL_SCENES } from '../../../shared/show';

export type PanelAction =
  | { type: 'blackout' }
  | { type: 'baseLook' }
  // The Scene button at `index`, 0 first.
  | { type: 'scene'; index: number }
  // Changes the Grand Master by `step`.
  | { type: 'grandMaster'; step: number };

// The parts of a keydown event the shortcuts read.
export interface KeyPress {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  // True while the key is held down and repeating.
  repeat: boolean;
}

// The shortcut keys, as shown on the panel.
export const SHORTCUTS = {
  blackout: 'B',
  baseLook: '0',
  grandMasterDown: '-',
  grandMasterUp: '+',
} as const;

const GRAND_MASTER_STEP = 0.1;

// The action a key press runs, or undefined. Keys with Ctrl, Alt or Meta are
// left to the app and the system. Holding a key repeats only Grand Master
// steps, so Blackout does not flicker.
export function panelAction({
  key,
  ctrlKey,
  altKey,
  metaKey,
  repeat,
}: KeyPress): PanelAction | undefined {
  if (ctrlKey || altKey || metaKey) return undefined;
  if (key === SHORTCUTS.grandMasterDown) return { type: 'grandMaster', step: -GRAND_MASTER_STEP };
  // = is + without Shift.
  if (key === SHORTCUTS.grandMasterUp || key === '=')
    return { type: 'grandMaster', step: GRAND_MASTER_STEP };
  if (repeat) return undefined;
  if (key.toUpperCase() === SHORTCUTS.blackout) return { type: 'blackout' };
  if (key === SHORTCUTS.baseLook) return { type: 'baseLook' };
  const digit = /^\d$/.test(key) ? Number(key) : 0;
  if (digit >= 1 && digit <= MAX_PANEL_SCENES) return { type: 'scene', index: digit - 1 };
  return undefined;
}

// The parts of a focused element that tell whether it takes typed text.
export interface FocusTarget {
  tagName: string;
  type?: string;
  isContentEditable?: boolean;
}

// Input types that take no typed text.
const NOT_TEXT = [
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
];

// Whether keys typed into `target` are text, so shortcuts must not take them.
export function isTextEntry(target: FocusTarget | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === 'TEXTAREA') return true;
  return target.tagName === 'INPUT' && !NOT_TEXT.includes(target.type ?? 'text');
}
