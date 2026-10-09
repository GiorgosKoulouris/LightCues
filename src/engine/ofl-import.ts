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

// An OFL matrix, whose pixels are our Cells: either a pixel count per axis
// or named pixels laid out z[y[x]], null for a hole. Pixel groups are only
// read for their keys.
interface OflMatrix {
  pixelCount?: [number, number, number];
  pixelKeys?: (string | null)[][][];
  pixelGroups?: Record<string, unknown>;
}

// Repeats template channels for each pixel or pixel group of the matrix.
interface OflMatrixInsert {
  insert: 'matrixChannels';
  repeatFor: string | string[];
  channelOrder: 'perPixel' | 'perChannel';
  templateChannels: (string | null)[];
}

interface OflFixture {
  name: string;
  categories: string[];
  availableChannels?: Record<string, OflChannel>;
  // Channels whose keys, aliases and names contain `$pixelKey`.
  templateChannels?: Record<string, OflChannel>;
  matrix?: OflMatrix;
  wheels?: Record<string, { slots: OflWheelSlot[] }>;
  modes: { name: string; channels: (string | null | OflMatrixInsert)[] }[];
}

// Imports one OFL fixture JSON. OFL files do not name their manufacturer (it
// is the parent directory), so the caller passes it.
export function importOflFixture(json: unknown, manufacturer: string): FixtureImport {
  if (!isOflFixture(json)) throw new Error('Not an Open Fixture Library fixture');
  const fixture = json;
  const report = createImportReport();
  const matrix = fixture.matrix && matrixKeys(fixture.matrix);
  const available = { ...resolvedTemplates(fixture, matrix), ...fixture.availableChannels };
  const channels = new Map<string, Channel>();
  for (const [key, channel] of Object.entries(available)) {
    for (const [modeKey, imported] of importChannel(key, channel, fixture, report)) {
      channels.set(modeKey, imported);
    }
  }

  const modes: FixtureMode[] = [];
  for (const mode of fixture.modes) {
    const keys = modeChannelKeys(mode.channels, matrix);
    if (!keys) {
      report.add({ mode: mode.name, feature: 'Matrix channels (mode not imported)' });
      continue;
    }
    modes.push({
      name: mode.name,
      channels: keys.map((key) =>
        key === null
          ? { kind: 'unused' }
          : (channels.get(key) ?? unresolvedChannel(key, available, report)),
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

// The pixel keys of a matrix, alphanumerically sorted, with their 1-based
// x/y/z positions, and its pixel group keys in file order.
interface MatrixKeys {
  pixels: { key: string; position: [number, number, number] }[];
  groups: string[];
}

function matrixKeys({ pixelCount, pixelKeys, pixelGroups }: OflMatrix): MatrixKeys {
  const pixels: MatrixKeys['pixels'] = [];
  if (pixelKeys) {
    pixelKeys.forEach((ys, z) =>
      ys.forEach((xs, y) =>
        xs.forEach((key, x) => {
          if (key !== null) pixels.push({ key, position: [x + 1, y + 1, z + 1] });
        }),
      ),
    );
  } else if (pixelCount) {
    const [xCount, yCount, zCount] = pixelCount;
    const axes = pixelCount.flatMap((count, axis) => (count > 1 ? [axis] : []));
    for (let z = 1; z <= zCount; z++) {
      for (let y = 1; y <= yCount; y++) {
        for (let x = 1; x <= xCount; x++) {
          const position: [number, number, number] = [x, y, z];
          pixels.push({ key: defaultPixelKey(position, axes), position });
        }
      }
    }
  }
  pixels.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  return { pixels, groups: Object.keys(pixelGroups ?? {}) };
}

// OFL's key for an unnamed pixel: its number along the one axis with more
// than one pixel, otherwise its position on those axes, e.g. "(2, 1)".
function defaultPixelKey(position: number[], axes: number[]): string {
  if (axes.length <= 1) return String(Math.max(...position));
  return `(${axes.map((axis) => position[axis]).join(', ')})`;
}

// Every template channel resolved for every pixel and pixel group, by
// resolved key.
function resolvedTemplates(
  fixture: OflFixture,
  matrix: MatrixKeys | undefined,
): Record<string, OflChannel> {
  if (!matrix) return {};
  const keys = [...matrix.pixels.map((p) => p.key), ...matrix.groups];
  return Object.fromEntries(
    Object.entries(fixture.templateChannels ?? {}).flatMap(([template, channel]) =>
      keys.map((pixelKey) => [
        resolveTemplate(template, pixelKey),
        withPixelKey(channel, pixelKey) as OflChannel,
      ]),
    ),
  );
}

function resolveTemplate(template: string, pixelKey: string): string {
  return template.replaceAll('$pixelKey', pixelKey);
}

// A copy of a template channel's JSON with `$pixelKey` resolved in every
// string and object key.
function withPixelKey(value: unknown, pixelKey: string): unknown {
  if (typeof value === 'string') return resolveTemplate(value, pixelKey);
  if (Array.isArray(value)) return value.map((item) => withPixelKey(item, pixelKey));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      resolveTemplate(key, pixelKey),
      withPixelKey(item, pixelKey),
    ]),
  );
}

// A mode's channel keys with matrix inserts expanded, null for an unused
// slot. Undefined when an insert cannot be expanded.
function modeChannelKeys(
  entries: OflFixture['modes'][number]['channels'],
  matrix: MatrixKeys | undefined,
): (string | null)[] | undefined {
  const keys: (string | null)[] = [];
  for (const entry of entries) {
    if (entry === null || typeof entry === 'string') {
      keys.push(entry);
      continue;
    }
    const pixels = matrix && entry.insert === 'matrixChannels' && repeatKeys(entry, matrix);
    if (!pixels) return undefined;
    const resolve = (template: string | null, pixelKey: string) =>
      template === null ? null : resolveTemplate(template, pixelKey);
    if (entry.channelOrder === 'perChannel') {
      for (const template of entry.templateChannels) {
        keys.push(...pixels.map((pixelKey) => resolve(template, pixelKey)));
      }
    } else {
      for (const pixelKey of pixels) {
        keys.push(...entry.templateChannels.map((template) => resolve(template, pixelKey)));
      }
    }
  }
  return keys;
}

// The pixel or pixel group keys an insert repeats for, in order.
function repeatKeys({ repeatFor }: OflMatrixInsert, matrix: MatrixKeys): string[] | undefined {
  if (Array.isArray(repeatFor)) return repeatFor;
  if (repeatFor === 'eachPixelABC') return matrix.pixels.map((p) => p.key);
  if (repeatFor === 'eachPixelGroup') return matrix.groups;
  const order = /^eachPixel([XYZ])([XYZ])([XYZ])$/.exec(repeatFor);
  if (!order) return undefined;
  // The first named axis changes fastest.
  const [first, second, third] = order.slice(1).map((axis) => 'XYZ'.indexOf(axis));
  const at = (position: number[], axis = 0) => position[axis] ?? 0;
  return matrix.pixels
    .toSorted(
      ({ position: a }, { position: b }) =>
        at(a, third) - at(b, third) || at(a, second) - at(b, second) || at(a, first) - at(b, first),
    )
    .map((p) => p.key);
}

// A mode key that is neither a channel nor a fine alias: a switching channel
// alias or a key the fixture does not define. It keeps its DMX slot.
function unresolvedChannel(
  key: string,
  available: Record<string, OflChannel>,
  report: ImportReport,
): Channel {
  const switching = Object.values(available).some((channel) =>
    channel.capabilities?.some((cap) => cap.switchChannels && key in cap.switchChannels),
  );
  const feature = switching ? 'Switching channel' : 'Unknown channel';
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
