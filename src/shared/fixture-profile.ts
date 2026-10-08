// The internal Fixture Profile model. Shared because the engine, the UI and
// saved Venue Patches all carry Profiles. All DMX values are 8-bit (0–255);
// 16/24-bit channels are split into a control channel and fine channels.

// The highest 8-bit DMX value.
export const DMX_MAX_VALUE = 255;

export const ROLES = ['Wash', 'Spot/Beam', 'Blinder', 'Strobe', 'Pixel/Bar', 'Effect'] as const;
export type Role = (typeof ROLES)[number];

export const EMITTERS = [
  'red',
  'green',
  'blue',
  'white',
  'warmWhite',
  'coldWhite',
  'amber',
  'lime',
  'cyan',
  'magenta',
  'yellow',
  'indigo',
  'uv',
] as const;
export type Emitter = (typeof EMITTERS)[number];

// A [start, end] pair across a capability's DMX range, e.g. degrees or Hz.
export type Span = [number, number];

// One slot on a colour wheel. `colour` is '#rrggbb'; an open slot is white.
export interface WheelSlot {
  name: string;
  colour: string;
}

export type Capability =
  | { type: 'none' }
  // `level` is the output fraction across the range; 0→1 when absent.
  | { type: 'intensity'; level?: Span }
  | { type: 'emitter'; emitter: Emitter; level?: Span }
  | { type: 'wheelSlot'; slot: WheelSlot }
  | { type: 'pan'; degrees?: Span }
  | { type: 'tilt'; degrees?: Span }
  | { type: 'shutter'; effect: 'open' | 'closed' }
  | { type: 'strobe'; hz?: Span }
  | { type: 'strobeSpeed'; hz?: Span }
  // Kept so the channel still occupies its DMX slot; reported on import.
  | { type: 'unsupported'; feature: string };

// An inclusive 8-bit DMX range of a channel and what it does.
export interface CapabilityRange {
  from: number;
  to: number;
  capability: Capability;
}

export type Channel =
  | { kind: 'control'; name: string; defaultValue: number; ranges: CapabilityRange[] }
  // `byte` is 1 for the 16-bit low byte, 2 for the 24-bit lowest byte.
  | { kind: 'fine'; name: string; of: string; byte: number; defaultValue: number }
  | { kind: 'unused' };

export interface FixtureMode {
  name: string;
  // Index = DMX offset from the Fixture's start address.
  channels: Channel[];
}

export interface FixtureProfile {
  // `<manufacturer-slug>/<model-slug>`; unique in the Profile Library.
  id: string;
  manufacturer: string;
  model: string;
  defaultRole: Role;
  modes: FixtureMode[];
}

// Something an imported fixture uses that a Profile cannot represent.
export interface UnsupportedFeature {
  channel?: string;
  mode?: string;
  feature: string;
}
