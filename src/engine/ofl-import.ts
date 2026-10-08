import type {
  Capability,
  CapabilityRange,
  Channel,
  Emitter,
  FixtureMode,
  FixtureProfile,
  Role,
  Span,
} from '../shared/fixture-profile';
import { profileId } from '../shared/profile-edit';
import {
  createImportReport,
  unsupported,
  type FixtureImport,
  type ImportReport,
} from './import-report';

// The subset of the Open Fixture Library fixture format we read.
// https://github.com/OpenLightingProject/open-fixture-library/blob/master/docs/fixture-format.md
interface OflCapability {
  type: string;
  dmxRange?: [number, number];
  color?: string;
  shutterEffect?: string;
  speed?: string;
  speedStart?: string;
  speedEnd?: string;
  wheel?: string;
  slotNumber?: number;
  angle?: string;
  angleStart?: string;
  angleEnd?: string;
  brightness?: string;
  brightnessStart?: string;
  brightnessEnd?: string;
  switchChannels?: Record<string, string | null>;
}

interface OflChannel {
  name?: string;
  fineChannelAliases?: string[];
  dmxValueResolution?: '8bit' | '16bit' | '24bit';
  defaultValue?: number | string;
  capability?: OflCapability;
  capabilities?: OflCapability[];
}

interface OflWheelSlot {
  type: string;
  name?: string;
  colors?: string[];
}

interface OflFixture {
  name: string;
  categories: string[];
  availableChannels?: Record<string, OflChannel>;
  wheels?: Record<string, { slots: OflWheelSlot[] }>;
  modes: { name: string; channels: unknown[] }[];
}

// Imports one OFL fixture JSON. OFL files do not name their manufacturer (it
// is the parent directory), so the caller passes it.
export function importOflFixture(json: unknown, manufacturer: string): FixtureImport {
  if (!isOflFixture(json)) throw new Error('Not an Open Fixture Library fixture');
  const fixture = json;
  const report = createImportReport();
  const channels = new Map<string, Channel>();
  for (const [key, channel] of Object.entries(fixture.availableChannels ?? {})) {
    for (const [modeKey, imported] of importChannel(key, channel, fixture, report)) {
      channels.set(modeKey, imported);
    }
  }

  const modes: FixtureMode[] = [];
  for (const mode of fixture.modes) {
    if (mode.channels.some((key) => key !== null && typeof key === 'object')) {
      report.add({ mode: mode.name, feature: 'Matrix channels (mode not imported)' });
      continue;
    }
    modes.push({
      name: mode.name,
      channels: mode.channels.map((key) =>
        key === null
          ? { kind: 'unused' }
          : (channels.get(key as string) ?? unresolvedChannel(key as string, fixture, report)),
      ),
    });
  }

  const profile: FixtureProfile = {
    id: profileId(manufacturer, fixture.name),
    manufacturer,
    model: fixture.name,
    defaultRole: defaultRole(fixture.categories),
    modes,
  };
  return { profile, unsupported: report.features };
}

// A shallow check; the rest of the file is trusted to follow the OFL schema.
function isOflFixture(json: unknown): json is OflFixture {
  const fixture = json as Partial<OflFixture> | null;
  return (
    typeof fixture?.name === 'string' &&
    Array.isArray(fixture.categories) &&
    Array.isArray(fixture.modes)
  );
}

// A mode key that is neither a channel nor a fine alias: a switching channel
// alias or a resolved matrix (pixel) channel. It keeps its DMX slot.
function unresolvedChannel(key: string, fixture: OflFixture, report: ImportReport): Channel {
  const switching = Object.values(fixture.availableChannels ?? {}).some((channel) =>
    channel.capabilities?.some((cap) => cap.switchChannels && key in cap.switchChannels),
  );
  const feature = switching ? 'Switching channel' : 'Matrix channel';
  report.add({ channel: key, feature });
  return {
    kind: 'control',
    name: key,
    defaultValue: 0,
    ranges: [{ from: 0, to: 255, capability: unsupported(feature) }],
  };
}

// The control channel under its key, then one fine channel per alias.
function importChannel(
  key: string,
  channel: OflChannel,
  fixture: OflFixture,
  report: ImportReport,
): [string, Channel][] {
  const name = channel.name ?? key;
  const aliases = channel.fineChannelAliases ?? [];
  const bytes = 1 + aliases.length;
  const resolution = channel.dmxValueResolution ? parseInt(channel.dmxValueResolution) / 8 : bytes;
  // OFL values are given at `resolution`; our ranges are 8-bit.
  const toCoarse = (value: number) => Math.floor(value / 256 ** (resolution - 1));
  const defaultValue = fullValue(channel.defaultValue ?? 0, resolution, bytes);
  const defaultByte = (byte: number) => Math.floor(defaultValue / 256 ** (bytes - 1 - byte)) % 256;

  const context: CapabilityContext = {
    wheel: (wheelName) => fixture.wheels?.[wheelName ?? name],
    report: (feature) => report.add({ channel: name, feature }),
  };
  const oflCapabilities = channel.capabilities ?? [
    { ...channel.capability!, dmxRange: [0, 256 ** resolution - 1] },
  ];
  const ranges = oflCapabilities.map((cap): CapabilityRange => ({
    from: toCoarse(cap.dmxRange![0]),
    to: toCoarse(cap.dmxRange![1]),
    capability: importCapability(cap, context),
  }));
  for (const { capability } of ranges) {
    if (capability.type === 'unsupported') context.report(capability.feature);
  }
  if (oflCapabilities.some((cap) => cap.switchChannels)) context.report('Switching channels');

  return [
    [key, { kind: 'control', name, defaultValue: defaultByte(0), ranges }],
    ...aliases.map((alias, i): [string, Channel] => [
      alias,
      { kind: 'fine', name: alias, of: name, byte: i + 1, defaultValue: defaultByte(i + 1) },
    ]),
  ];
}

interface CapabilityContext {
  // The named wheel; OFL defaults the name to the channel's name.
  wheel(name: string | undefined): { slots: OflWheelSlot[] } | undefined;
  // Reports a feature that was read only in part.
  report(feature: string): void;
}

function importCapability(cap: OflCapability, context: CapabilityContext): Capability {
  // Reads an optional [start, end] property pair, reporting values we cannot place.
  const span = (parsed: Span | null | undefined, what: string): Span | undefined => {
    if (parsed === null) context.report(`${cap.type} ${what}`);
    return parsed ?? undefined;
  };
  const level = () =>
    span(
      pair(cap.brightnessStart ?? cap.brightness, cap.brightnessEnd ?? cap.brightness, brightness),
      'brightness not in %',
    );
  const hz = () =>
    span(
      pair(cap.speedStart ?? cap.speed, cap.speedEnd ?? cap.speed, unit('Hz')),
      'speed not in Hz',
    );
  const degrees = () =>
    span(
      pair(cap.angleStart ?? cap.angle, cap.angleEnd ?? cap.angle, unit('deg')),
      'angle not in degrees',
    );

  switch (cap.type) {
    case 'NoFunction':
      return { type: 'none' };
    case 'Intensity':
      return { type: 'intensity', level: level() };
    case 'ColorIntensity': {
      const emitter = EMITTERS[cap.color!];
      if (emitter) return { type: 'emitter', emitter, level: level() };
      break;
    }
    case 'ShutterStrobe':
      switch (cap.shutterEffect) {
        case 'Open':
          return { type: 'shutter', effect: 'open' };
        case 'Closed':
          return { type: 'shutter', effect: 'closed' };
        case 'Strobe':
          return { type: 'strobe', hz: hz() };
      }
      return unsupported(`ShutterStrobe ${cap.shutterEffect}`);
    case 'StrobeSpeed':
      return { type: 'strobeSpeed', hz: hz() };
    case 'Pan':
      return { type: 'pan', degrees: degrees() };
    case 'Tilt':
      return { type: 'tilt', degrees: degrees() };
    case 'WheelSlot':
      return importWheelSlot(cap, context);
  }
  return unsupported(cap.type);
}

function importWheelSlot(cap: OflCapability, context: CapabilityContext): Capability {
  // Fractional or proportional slot numbers select a split between two slots.
  if (cap.slotNumber === undefined || !Number.isInteger(cap.slotNumber)) {
    return unsupported('WheelSlot between slots');
  }
  // OFL slot numbers are 1-based.
  const slot = context.wheel(cap.wheel)?.slots[cap.slotNumber - 1];
  if (!slot) return unsupported('WheelSlot with missing wheel slot');
  if (slot.type === 'Open') return { type: 'wheelSlot', slot: { name: 'Open', colour: '#ffffff' } };
  if (slot.type !== 'Color') return unsupported(`WheelSlot ${slot.type}`);
  if (slot.colors?.length !== 1) return unsupported('WheelSlot Color without a single colour');
  const colour = slot.colors[0]!;
  return { type: 'wheelSlot', slot: { name: slot.name ?? colour, colour } };
}

// An OFL start/end property pair: undefined when absent, null when either
// value is in a unit or word we cannot place.
function pair(
  start: string | undefined,
  end: string | undefined,
  parse: (value: string) => number | undefined,
): Span | null | undefined {
  if (start === undefined || end === undefined) return undefined;
  const from = parse(start);
  const to = parse(end);
  return from === undefined || to === undefined ? null : [from, to];
}

function unit(suffix: string) {
  return (value: string) => (value.endsWith(suffix) ? parseFloat(value) : undefined);
}

// Brightness as a fraction of full output. 'dark' and lumens have no fixed fraction.
function brightness(value: string): number | undefined {
  if (value === 'off') return 0;
  if (value === 'bright') return 1;
  return value.endsWith('%') ? parseFloat(value) / 100 : undefined;
}

const EMITTERS: Record<string, Emitter> = {
  Red: 'red',
  Green: 'green',
  Blue: 'blue',
  White: 'white',
  'Warm White': 'warmWhite',
  'Cold White': 'coldWhite',
  Amber: 'amber',
  Lime: 'lime',
  Cyan: 'cyan',
  Magenta: 'magenta',
  Yellow: 'yellow',
  Indigo: 'indigo',
  UV: 'uv',
};

// An OFL DMX value (a number at `resolution` bytes, or a percentage like
// '50%') scaled to the channel's full `bytes` resolution.
function fullValue(value: number | string, resolution: number, bytes: number): number {
  if (typeof value === 'number') return value * 256 ** (bytes - resolution);
  return Math.round((parseFloat(value) / 100) * (256 ** bytes - 1));
}

// OFL categories are ordered most important first. Stand and Other carry no
// Role; a fixture with only those defaults to Wash.
const CATEGORY_ROLES: Record<string, Role> = {
  Dimmer: 'Wash',
  'Color Changer': 'Wash',
  'Moving Head': 'Spot/Beam',
  Scanner: 'Spot/Beam',
  'Barrel Scanner': 'Spot/Beam',
  Blinder: 'Blinder',
  Strobe: 'Strobe',
  'Pixel Bar': 'Pixel/Bar',
  Matrix: 'Pixel/Bar',
  Effect: 'Effect',
  Flower: 'Effect',
  Laser: 'Effect',
  Fan: 'Effect',
  Hazer: 'Effect',
  Smoke: 'Effect',
};

function defaultRole(categories: string[]): Role {
  for (const category of categories) {
    const role = CATEGORY_ROLES[category];
    if (role) return role;
  }
  return 'Wash';
}
