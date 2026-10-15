// The Fallback Panel's keyboard shortcuts. Pure, so they are testable without
// a DOM.
import { MAX_HOUSE_PRESETS, MAX_PANEL_SCENES } from '../../../shared/show';

export type PanelAction =
  | { type: 'blackout' }
  | { type: 'baseLook' }
  | { type: 'tapTempo' }
  | { type: 'freeze' }
  // The Scene button at `index`, 0 first.
  | { type: 'scene'; index: number }
  // The House Preset at `index`, 0 first.
  | { type: 'housePreset'; index: number }
  // Changes the Grand Master by `step`.
  | { type: 'grandMaster'; step: number };

// The parts of a keydown event the shortcuts read.
export interface KeyPress {
  key: string;
  // The physical key, such as Digit1, whatever the layout types.
  code: string;
  shiftKey: boolean;
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
  tapTempo: 'T',
  freeze: 'F',
  grandMasterDown: '-',
  grandMasterUp: '+',
} as const;

// The House Preset key at `index`, 0 first, as shown on the panel.
export const housePresetKey = (index: number) => `⇧${index + 1}`;

const GRAND_MASTER_STEP = 0.1;

// The action a key press runs, or undefined. Keys with Ctrl, Alt or Meta are
// left to the app and the system. Holding a key repeats only Grand Master
// steps, so Blackout and Freeze do not flicker and a held T is one tap.
// Shift+1–8 go by the physical key, since Shift changes the digit typed.
export function panelAction({
  key,
  code,
  shiftKey,
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
  const shiftedDigit = shiftKey && /^Digit\d$/.test(code) ? Number(code.slice(-1)) : 0;
  if (shiftedDigit >= 1 && shiftedDigit <= MAX_HOUSE_PRESETS)
    return { type: 'housePreset', index: shiftedDigit - 1 };
  if (key.toUpperCase() === SHORTCUTS.blackout) return { type: 'blackout' };
  if (key.toUpperCase() === SHORTCUTS.tapTempo) return { type: 'tapTempo' };
  if (key.toUpperCase() === SHORTCUTS.freeze) return { type: 'freeze' };
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
