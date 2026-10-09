import { XMLParser } from 'fast-xml-parser';
import { strFromU8, unzipSync } from 'fflate';
import { isDeepStrictEqual } from 'node:util';
import {
  DMX_MAX_VALUE,
  type Capability,
  type CapabilityRange,
  type Channel,
  type Emitter,
  type FixtureMode,
  type FixtureProfile,
  type Role,
  type Span,
} from '../shared/fixture-profile';
import { profileId } from '../shared/profile-edit';
import { cieToHex } from './cie-colour';
import {
  createImportReport,
  unsupported,
  type FixtureImport,
  type ImportReport,
} from './import-report';

// The subset of GDTF `description.xml` we read (GDTF 1.0–1.2, DIN SPEC 15800).
// Attributes keep their XML names; repeatable elements are always arrays.
interface GdtfChannelFunction {
  Name?: string;
  Attribute?: string;
  DMXFrom?: string;
  // GDTF 1.1 and later; 1.0 puts it on the DMXChannel.
  Default?: string;
  PhysicalFrom?: string;
  PhysicalTo?: string;
  // Set on a function that applies only while another channel is in a range.
  ModeMaster?: string;
  ModeFrom?: string;
  ModeTo?: string;
  // The Wheel a Color1, Gobo1, ... function selects slots on.
  Wheel?: string;
  ChannelSet?: GdtfChannelSet[];
}

interface GdtfChannelSet {
  Name?: string;
  DMXFrom?: string;
  // 1-based slot on the function's Wheel. Absent between slots.
  WheelSlotIndex?: string;
}

interface GdtfLogicalChannel {
  Attribute?: string;
  ChannelFunction?: GdtfChannelFunction[];
}

interface GdtfDmxChannel {
  // The DMX break the Offset counts in; 1 when absent. "Overwrite" takes it
  // from the cell's last Break.
  DMXBreak?: string;
  // Comma-separated 1-based slots, coarse first. Absent or "None" for a
  // virtual channel. Relative to the cell's Break for a channel in a cell.
  Offset?: string;
  Geometry?: string;
  // GDTF 1.0 only.
  Default?: string;
  // `<geometry>_<attribute>.<attribute>.<function name>` in GDTF 1.1 and later.
  InitialFunction?: string;
  LogicalChannel?: GdtfLogicalChannel[];
}

interface GdtfDmxMode {
  Name?: string;
  // The top-level geometry the mode controls.
  Geometry?: string;
  DMXChannels?: { DMXChannel?: GdtfDmxChannel[] };
}

interface GdtfWheel {
  Name?: string;
  Slot?: GdtfWheelSlot[];
}

interface GdtfWheelSlot {
  Name?: string;
  // CIE 1931 `x,y,Y`.
  Color?: string;
}

// Any geometry element: Geometry, Axis, Beam, ... Child geometries sit under
// their element names, next to the element's attributes.
type GdtfGeometry = Record<string, unknown> & { Name?: string };

// One instance of the top-level geometry it names: a cell.
interface GdtfGeometryReference {
  Name?: string;
  Geometry?: string;
  Break?: GdtfBreak[];
}

// Where a cell's channels start in one DMX break.
interface GdtfBreak {
  DMXBreak?: string;
  DMXOffset?: string;
}

interface GdtfFixtureType {
  Name?: string;
  LongName?: string;
  Manufacturer?: string;
  Wheels?: { Wheel?: GdtfWheel[] };
  Geometries?: GdtfGeometry;
  DMXModes?: { DMXMode?: GdtfDmxMode[] };
}

const REPEATED = new Set([
  'DMXMode',
  'DMXChannel',
  'LogicalChannel',
  'ChannelFunction',
  'ChannelSet',
  'Wheel',
  'Slot',
  'Geometry',
  'GeometryReference',
  'Break',
]);

// Wheel slots by wheel name.
type Wheels = Map<string, GdtfWheelSlot[]>;

// Top-level geometries by name.
type Geometries = Map<string, GdtfGeometry>;

// Imports one `.gdtf` file: a zip archive whose `description.xml` describes
// the fixture. Models, images and everything else in the archive are ignored.
export function importGdtfFixture(bytes: Uint8Array): FixtureImport {
  const fixtureType = readFixtureType(bytes);
  const report = createImportReport();
  const manufacturer = fixtureType.Manufacturer ?? '';
  const model = fixtureType.Name || fixtureType.LongName || '';
  const wheels: Wheels = new Map(
    (fixtureType.Wheels?.Wheel ?? []).map((wheel) => [wheel.Name ?? '', wheel.Slot ?? []]),
  );
  const geometries: Geometries = new Map(
    childGeometries(fixtureType.Geometries).map(([, geometry]) => [geometry.Name ?? '', geometry]),
  );
  const imported = (fixtureType.DMXModes?.DMXMode ?? []).map((gdtfMode) => ({
    gdtfMode,
    mode: importMode(gdtfMode, wheels, geometries, report),
  }));
  const profile: FixtureProfile = {
    id: profileId(manufacturer, model),
    manufacturer,
    model,
    defaultRole: defaultRole(imported, geometries),
    modes: imported.map(({ mode }) => mode),
  };
  return { profile, unsupported: report.features };
}

// Attribute patterns for the default Role rules (DIN SPEC 15800).
const PAN_TILT = /^(Pan|Tilt)$/;
// Gobo1, Gobo1Pos, Prism1, ...
const GOBO_PRISM = /^(Gobo|Prism)\d/;
// Shutter1, Shutter1Strobe, StrobeRate, StrobeDuration, ...
const SHUTTER_OR_STROBE = /^(Shutter\d|Strobe)/;
// What else a strobe may have: Dimmer with DimmerMode, ..., and built-in programs
// with their speed: Effects1, EffectsRate, GlobalMSpeed, ...
const STROBE_FIXTURE = /^(Shutter\d|Strobe|Dimmer|Effects)|MSpeed$/;
// Fog1, FogType1, Haze1, Fans, FanMode, Blower1, ...
const EFFECT = /^(Fog|Haze|Fan|Blower)/;
// Additive, subtractive, RGB, HSB and CIE colour, and Dimmer, DimmerMode, ...
const EMITTER_OR_DIMMER = /^(ColorAdd_|ColorSub_|ColorRGB_|HSB_|CIE_|Dimmer)/;
// Channels any fixture may have, which say nothing about its Role.
const HOUSEKEEPING = /^(NoFeature|Control\d+|FixtureGlobalReset|Function)$/;

// GDTF has no categories, so the Role comes from the attributes of the
// largest mode; the first of equally large ones. The first matching rule
// wins.
function defaultRole(
  modes: { gdtfMode: GdtfDmxMode; mode: FixtureMode }[],
  geometries: Geometries,
): Role {
  const largest = modes.reduce<(typeof modes)[number] | undefined>(
    (best, m) => (!best || m.mode.channels.length > best.mode.channels.length ? m : best),
    undefined,
  );
  if (!largest) return 'Wash';
  const dmxChannels = largest.gdtfMode.DMXChannels?.DMXChannel ?? [];
  const attributes = dmxChannels.flatMap((dmxChannel) =>
    (dmxChannel.LogicalChannel ?? []).flatMap((logical) => [
      logical.Attribute ?? '',
      ...(logical.ChannelFunction ?? []).map((f) => f.Attribute ?? ''),
    ]),
  );
  const has = (pattern: RegExp) => attributes.some((attribute) => pattern.test(attribute));
  const only = (pattern: RegExp) =>
    attributes.every((attribute) => HOUSEKEEPING.test(attribute) || pattern.test(attribute));
  const cellsOf = cellLookup(largest.gdtfMode, geometries);
  const cells = new Set(dmxChannels.flatMap((dmxChannel) => cellsOf(dmxChannel.Geometry)));
  if (has(PAN_TILT)) return has(GOBO_PRISM) ? 'Spot/Beam' : 'Wash';
  if (cells.size > 1) return 'Pixel/Bar';
  if (has(SHUTTER_OR_STROBE) && only(STROBE_FIXTURE)) return 'Strobe';
  if (has(EFFECT) && !has(EMITTER_OR_DIMMER)) return 'Effect';
  return 'Wash';
}

// A .gdtf carries 3D models and images, so its cap is generous.
const MAX_GDTF_BYTES = 256 * 1024 * 1024;
const MAX_DESCRIPTION_BYTES = 16 * 1024 * 1024;
const DESCRIPTION_TOO_LARGE = 'description.xml is too large (over 16 MB)';

function readFixtureType(bytes: Uint8Array): GdtfFixtureType {
  if (bytes.length > MAX_GDTF_BYTES) throw new Error('File is too large (over 256 MB)');
  let files: Record<string, Uint8Array>;
  let tooLarge = false;
  try {
    files = unzipSync(bytes, {
      filter: (file) => {
        if (file.name !== 'description.xml') return false;
        if (file.originalSize <= MAX_DESCRIPTION_BYTES) return true;
        tooLarge = true;
        return false;
      },
    });
  } catch {
    throw new Error('Not a GDTF file');
  }
  if (tooLarge) throw new Error(DESCRIPTION_TOO_LARGE);
  const xml = files['description.xml'];
  if (!xml) throw new Error('Not a GDTF file: description.xml is missing');
  // The zip header size can lie.
  if (xml.length > MAX_DESCRIPTION_BYTES) throw new Error(DESCRIPTION_TOO_LARGE);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: false,
    // GDTF never uses DOCTYPE entities, so none are expanded. Turning entities
    // off also leaves the XML ones (`&amp;`, ...), so those are decoded here.
    processEntities: false,
    attributeValueProcessor: (_name, value) => decodeXmlEntities(value),
    tagValueProcessor: (_name, value) => decodeXmlEntities(value),
    // `Wheel` is also a ChannelFunction attribute.
    isArray: (name, _path, _isLeaf, isAttribute) => !isAttribute && REPEATED.has(name),
  });
  const document = parser.parse(strFromU8(xml)) as { GDTF?: { FixtureType?: GdtfFixtureType } };
  const fixtureType = document.GDTF?.FixtureType;
  if (!fixtureType) throw new Error('Not a GDTF file: description.xml has no FixtureType');
  return fixtureType;
}

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

// The five entities XML predefines, in one pass so `&amp;lt;` stays `&lt;`.
function decodeXmlEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos);/g, (_match, name: string) => XML_ENTITIES[name]!);
}

// A Profile mode is one DMX block, so only channels in the mode's lowest DMX
// break are imported; each other break is reported once. A multi-cell fixture
// is flattened: a channel on a referenced geometry repeats once per cell.
function importMode(
  mode: GdtfDmxMode,
  wheels: Wheels,
  geometries: Geometries,
  report: ImportReport,
): FixtureMode {
  const name = mode.Name ?? '';
  const cellsOf = cellLookup(mode, geometries);
  const placements = (mode.DMXChannels?.DMXChannel ?? []).flatMap((dmxChannel) =>
    placementsOf(dmxChannel, cellsOf(dmxChannel.Geometry)),
  );
  const firstBreak = Math.min(
    ...placements.flatMap(({ dmxChannel, dmxBreak }) =>
      dmxBreak === undefined || isVirtual(dmxChannel) ? [] : [dmxBreak],
    ),
  );
  const channels: Channel[] = [];
  const names = new Set<string>();
  const slotsPerOtherBreak = new Map<number, Set<number>>();
  for (const { dmxChannel, cell, dmxBreak, breakOffset } of placements) {
    const attributeName = channelNameOf(dmxChannel.LogicalChannel?.[0]);
    const channelName = uniqueName(
      cell === undefined ? attributeName : `${attributeName} (Cell ${cell})`,
      names,
    );
    const notImported = (feature: string) =>
      report.add({ channel: channelName, mode: name, feature });
    if (isVirtual(dmxChannel)) {
      notImported('Virtual channel');
      continue;
    }
    if (dmxBreak === undefined) {
      notImported(`No Break for DMX break ${dmxChannel.DMXBreak ?? 1} in cell ${cell}`);
      continue;
    }
    if (!(Number.isInteger(breakOffset) && breakOffset >= 1)) {
      notImported(`Invalid DMXOffset in cell ${cell}`);
      continue;
    }
    const offsets = dmxChannel.Offset!.split(',').map((offset) => Number(offset) + breakOffset - 1);
    if (!offsets.every((offset) => Number.isInteger(offset) && offset >= 1)) {
      notImported(`Invalid DMX offset "${dmxChannel.Offset}"`);
      continue;
    }
    if (dmxBreak !== firstBreak) {
      const slots = slotsPerOtherBreak.get(dmxBreak) ?? new Set();
      offsets.forEach((offset) => slots.add(offset));
      slotsPerOtherBreak.set(dmxBreak, slots);
      continue;
    }
    names.add(channelName);
    const imported = importChannel(dmxChannel, channelName, offsets.length, wheels, (feature) =>
      report.add({ channel: channelName, feature }),
    );
    imported.forEach((channel, byte) => (channels[offsets[byte]! - 1] = channel));
  }
  for (const [dmxBreak, { size }] of [...slotsPerOtherBreak].sort(([a], [b]) => a - b)) {
    const count = `${size} channel${size === 1 ? '' : 's'}`;
    report.add({ mode: name, feature: `DMX break ${dmxBreak} (${count})` });
  }
  // Gaps between offsets are unused slots.
  return { name, channels: Array.from(channels, (c) => c ?? { kind: 'unused' }) };
}

// A virtual channel is controlled by the console alone and takes no slot.
function isVirtual(dmxChannel: GdtfDmxChannel): boolean {
  return !dmxChannel.Offset || dmxChannel.Offset === 'None';
}

// The cells of a mode whose geometry holds `geometry`, in reference order. A
// geometry in the mode's main tree is in no cell, even if a cell has one of
// the same name.
function cellLookup(
  mode: GdtfDmxMode,
  geometries: Geometries,
): (geometry: string | undefined) => GdtfGeometryReference[] {
  const root = geometries.get(mode.Geometry ?? '');
  const references = geometryReferences(root);
  const mainGeometries = new Set(geometryNames(root));
  return (geometry) =>
    !geometry || mainGeometries.has(geometry)
      ? []
      : references.filter((reference) =>
          geometryNames(geometries.get(reference.Geometry ?? '')).includes(geometry),
        );
}

// Where a DMX channel goes in a mode: its DMX break and the slot its Offset
// counts from. `cell` numbers the instance of a channel in a cell, from 1;
// `dmxBreak` is undefined when the cell has no Break for the channel.
interface Placement {
  dmxChannel: GdtfDmxChannel;
  cell?: number;
  dmxBreak?: number;
  breakOffset: number;
}

// One placement per cell, or one as given for a channel in no cell.
function placementsOf(dmxChannel: GdtfDmxChannel, cells: GdtfGeometryReference[]): Placement[] {
  if (cells.length === 0) {
    return [{ dmxChannel, dmxBreak: breakNumber(dmxChannel.DMXBreak), breakOffset: 1 }];
  }
  return cells.map((reference, i) => {
    const cellBreak = breakIn(reference, dmxChannel.DMXBreak);
    return {
      dmxChannel,
      cell: i + 1,
      dmxBreak: cellBreak && breakNumber(cellBreak.DMXBreak),
      breakOffset: Number(cellBreak?.DMXOffset ?? 1),
    };
  });
}

// The Break a channel's DMXBreak picks in a cell: the last one for
// "Overwrite".
function breakIn(reference: GdtfGeometryReference, dmxBreak: string | undefined) {
  const breaks = reference.Break ?? [];
  if (dmxBreak === 'Overwrite') return breaks.at(-1);
  return breaks.find((b) => breakNumber(b.DMXBreak) === breakNumber(dmxBreak));
}

// A DMX break number, 1 when absent. "Overwrite" outside a cell has no Break
// to take a number from, so it reads as 1 too.
function breakNumber(text: string | undefined): number {
  const number = Number(text ?? 1);
  return Number.isNaN(number) ? 1 : number;
}

// The GeometryReferences under a geometry. The XML parser groups children by
// element name, so references under different parents keep their document
// order only within each parent.
function geometryReferences(geometry: GdtfGeometry | undefined): GdtfGeometryReference[] {
  return childGeometries(geometry).flatMap(([element, child]) =>
    element === 'GeometryReference' ? [child as GdtfGeometryReference] : geometryReferences(child),
  );
}

// The names of a geometry and all geometries under it, short of nested
// references.
function geometryNames(geometry: GdtfGeometry | undefined): string[] {
  if (!geometry) return [];
  return [
    geometry.Name ?? '',
    ...childGeometries(geometry).flatMap(([element, child]) =>
      element === 'GeometryReference' ? [] : geometryNames(child),
    ),
  ];
}

// Child elements of a geometry with their element names. Attributes are
// strings, so only elements are objects.
function childGeometries(geometry: unknown): [string, GdtfGeometry][] {
  if (typeof geometry !== 'object' || geometry === null) return [];
  return Object.entries(geometry).flatMap(([element, value]) =>
    (Array.isArray(value) ? value : [value])
      .filter((child): child is GdtfGeometry => typeof child === 'object' && child !== null)
      .map((child): [string, GdtfGeometry] => [element, child]),
  );
}

// Fine channels link to their control channel by name, so names in a mode
// must differ: a repeated one gets a number.
function uniqueName(name: string, taken: Set<string>): string {
  let unique = name;
  for (let n = 2; taken.has(unique); n++) unique = `${name} ${n}`;
  return unique;
}

function channelNameOf(logical: GdtfLogicalChannel | undefined): string {
  const attribute = logical?.Attribute ?? 'Unnamed';
  const emitter = EMITTERS[attribute];
  return emitter ? EMITTER_NAMES[emitter] : attribute;
}

// The control channel, then one fine channel per further byte of its `width`.
// `reportFeature` takes a feature the Profile cannot represent.
function importChannel(
  dmxChannel: GdtfDmxChannel,
  name: string,
  width: number,
  wheels: Wheels,
  reportFeature: (feature: string) => void,
): Channel[] {
  const functions = modeIndependent(
    dmxChannel.LogicalChannel?.[0]?.ChannelFunction ?? [],
    reportFeature,
  );
  const ranges: CapabilityRange[] =
    functions.length > 0
      ? importRanges(functions, width, wheels)
      : [{ from: 0, to: DMX_MAX_VALUE, capability: unsupported('No channel function') }];
  for (const { capability } of ranges) {
    if (capability.type === 'unsupported') reportFeature(capability.feature);
  }
  const defaultValue = dmxValue(defaultText(dmxChannel, functions) ?? '0/1', width);
  const defaultByte = (byte: number) => Math.floor(defaultValue / 256 ** (width - 1 - byte)) % 256;
  return [
    { kind: 'control', name, defaultValue: defaultByte(0), ranges },
    ...Array.from({ length: width - 1 }, (_, i): Channel => ({
      kind: 'fine',
      name: `${name} fine${i > 0 ? `^${i + 1}` : ''}`,
      of: name,
      byte: i + 1,
      defaultValue: defaultByte(i + 1),
    })),
  ];
}

// GDTF 1.0 gives the default on the channel; later versions on the initial
// channel function.
function defaultText(
  dmxChannel: GdtfDmxChannel,
  functions: GdtfChannelFunction[],
): string | undefined {
  if (dmxChannel.Default) return dmxChannel.Default;
  const initialName = dmxChannel.InitialFunction?.split('.').at(-1);
  const initial = functions.find((f) => f.Name === initialName) ?? functions[0];
  return initial?.Default;
}

// Functions that depend on another channel's value (ModeMaster) overlap the
// rest. Keeps those that apply together with the first one.
function modeIndependent(
  functions: GdtfChannelFunction[],
  reportFeature: (feature: string) => void,
): GdtfChannelFunction[] {
  const group = (f: GdtfChannelFunction) => [f.ModeMaster, f.ModeFrom, f.ModeTo].join('|');
  const first = functions[0] && group(functions[0]);
  const kept = functions.filter((f) => group(f) === first);
  if (kept.length < functions.length) reportFeature('Mode-dependent channel functions');
  return kept;
}

// One range per channel function, from its DMXFrom to the next one's.
// Shutter and colour wheel functions split further by their channel sets.
function importRanges(
  functions: GdtfChannelFunction[],
  width: number,
  wheels: Wheels,
): CapabilityRange[] {
  const starts: { start: number; capability: Capability }[] = [];
  for (const channelFunction of functions) {
    const start = dmxValue(channelFunction.DMXFrom ?? '0/1', width);
    const setCapability = channelSetImporter(channelFunction, wheels);
    const setStarts = setCapability
      ? (channelFunction.ChannelSet ?? []).map((channelSet) => ({
          start: dmxValue(channelSet.DMXFrom ?? '0/1', width),
          capability: setCapability(channelSet),
        }))
      : [];
    // A function whose sets leave its start uncovered keeps that part.
    if (!setStarts.some((s) => s.start <= start)) {
      starts.push({ start, capability: importCapability(channelFunction) });
    }
    starts.push(...setStarts);
  }
  starts.sort((a, b) => a.start - b.start);

  const end = 256 ** width;
  const ranges: CapabilityRange[] = [];
  starts.forEach(({ start, capability }, i) => {
    // Ranges are 8-bit, so a finer one may share its coarse value with the
    // previous one; the earlier range keeps it.
    const previous = ranges.at(-1);
    const from = Math.max(toCoarse(start, width), (previous?.to ?? -1) + 1);
    const to = toCoarse((starts[i + 1]?.start ?? end) - 1, width);
    if (from > to) return;
    // Adjacent ranges with the same capability read as one.
    if (previous && isDeepStrictEqual(previous.capability, capability)) previous.to = to;
    else ranges.push({ from, to, capability });
  });
  return ranges;
}

// Maps each channel set of a function whose sets carry their own capability:
// shutter Open/Closed and colour wheel slots.
function channelSetImporter(
  channelFunction: GdtfChannelFunction,
  wheels: Wheels,
): ((channelSet: GdtfChannelSet) => Capability) | undefined {
  const attribute = channelFunction.Attribute ?? '';
  if (SHUTTER.test(attribute)) return (channelSet) => shutter(channelFunction, channelSet);
  if (COLOUR_WHEEL.test(attribute)) {
    const slots = wheels.get(channelFunction.Wheel ?? '');
    return (channelSet) => wheelSlot(attribute, channelSet, slots);
  }
  return undefined;
}

function importCapability(channelFunction: GdtfChannelFunction): Capability {
  const attribute = channelFunction.Attribute ?? '';
  const physical = (): Span | undefined => {
    const from = parseFloat(channelFunction.PhysicalFrom ?? '');
    const to = parseFloat(channelFunction.PhysicalTo ?? '');
    return Number.isNaN(from) || Number.isNaN(to) ? undefined : [from, to];
  };
  const emitter = EMITTERS[attribute];
  if (emitter) return { type: 'emitter', emitter };
  if (SHUTTER.test(attribute)) return shutter(channelFunction);
  if (STROBE.test(attribute)) return { type: 'strobe', hz: physical() };
  switch (attribute) {
    case 'NoFeature':
      return { type: 'none' };
    case 'Dimmer':
      return { type: 'intensity' };
    case 'Pan':
      return { type: 'pan', degrees: physical() };
    case 'Tilt':
      return { type: 'tilt', degrees: physical() };
  }
  return unsupported(attribute);
}

const SHUTTER = /^Shutter\d+$/;
// Color1, Color2, ...; not Color1WheelSpin and the like.
const COLOUR_WHEEL = /^Color\d+$/;
// Shutter1Strobe, Shutter1StrobePulse, Shutter1StrobeRandom and the like.
const STROBE = /^Shutter\d+Strobe/;

// Open or Closed, read from the channel set name, else the function name,
// else the function's physical value: 1 is open and 0 closed.
function shutter(channelFunction: GdtfChannelFunction, channelSet?: GdtfChannelSet): Capability {
  const attribute = channelFunction.Attribute ?? '';
  const from = parseFloat(channelFunction.PhysicalFrom ?? '');
  const to = parseFloat(channelFunction.PhysicalTo ?? '');
  const physical =
    from !== to ? undefined : from === 1 ? 'open' : from === 0 ? 'closed' : undefined;
  const effect = shutterEffect(channelSet?.Name) ?? shutterEffect(channelFunction.Name) ?? physical;
  if (effect) return { type: 'shutter', effect };
  return unsupported(`${attribute} ${channelSet?.Name ?? channelFunction.Name ?? ''}`.trim());
}

function shutterEffect(name = ''): 'open' | 'closed' | undefined {
  if (/open/i.test(name)) return 'open';
  if (/clos/i.test(name)) return 'closed';
  return undefined;
}

// Split colours sit between slots: no slot index, or 0. An open slot is
// white and named "Open", as in OFL import.
function wheelSlot(
  attribute: string,
  channelSet: GdtfChannelSet,
  slots: GdtfWheelSlot[] | undefined,
): Capability {
  const index = Number(channelSet.WheelSlotIndex ?? 0);
  if (!(index >= 1)) return unsupported(`${attribute} between slots`);
  const slot = slots?.[index - 1];
  if (!slot) return unsupported(`${attribute} missing wheel slot`);
  if (/^open$/i.test(slot.Name ?? '')) {
    return { type: 'wheelSlot', slot: { name: 'Open', colour: '#ffffff' } };
  }
  const colour = cieToHex(slot.Color);
  return { type: 'wheelSlot', slot: { name: slot.Name || colour, colour } };
}

// Additive and RGB colour attributes. RY (red-yellow) is amber and GY
// (green-yellow) is lime.
const EMITTERS: Record<string, Emitter> = {
  ColorAdd_R: 'red',
  ColorAdd_G: 'green',
  ColorAdd_B: 'blue',
  ColorAdd_W: 'white',
  ColorAdd_WW: 'warmWhite',
  ColorAdd_CW: 'coldWhite',
  ColorAdd_A: 'amber',
  ColorAdd_RY: 'amber',
  ColorAdd_L: 'lime',
  ColorAdd_GY: 'lime',
  ColorAdd_C: 'cyan',
  ColorAdd_M: 'magenta',
  ColorAdd_Y: 'yellow',
  ColorAdd_UV: 'uv',
  ColorRGB_Red: 'red',
  ColorRGB_Green: 'green',
  ColorRGB_Blue: 'blue',
  ColorRGB_Cyan: 'cyan',
  ColorRGB_Magenta: 'magenta',
  ColorRGB_Yellow: 'yellow',
};

// Channel names for emitter attributes, which read poorly as names.
const EMITTER_NAMES: Record<Emitter, string> = {
  red: 'Red',
  green: 'Green',
  blue: 'Blue',
  white: 'White',
  warmWhite: 'Warm White',
  coldWhite: 'Cold White',
  amber: 'Amber',
  lime: 'Lime',
  cyan: 'Cyan',
  magenta: 'Magenta',
  yellow: 'Yellow',
  indigo: 'Indigo',
  uv: 'UV',
};

// A GDTF DMX value `value/n`, given at n bytes, scaled to `width` bytes. A finer
// value is cut; a coarser one is byte-mirrored (255/1 is 65535/2) or, with an
// `s` suffix, byte-shifted (255/1s is 65280/2).
function dmxValue(text: string, width: number): number {
  const match = /^(\d+)\/(\d+)(s?)$/.exec(text.trim());
  if (!match) throw new Error(`Invalid DMX value "${text}"`);
  const [, value, given, shift] = match;
  let full = Number(value);
  const n = Number(given);
  if (n >= width) return Math.floor(full / 256 ** (n - width));
  for (let byte = n; byte < width; byte++) {
    // Mirroring repeats the given bytes, most significant first.
    const mirrored = Math.floor(Number(value) / 256 ** (n - 1 - ((byte - n) % n))) % 256;
    full = full * 256 + (shift ? 0 : mirrored);
  }
  return full;
}

// The top byte of a value `width` bytes wide: our ranges are 8-bit.
function toCoarse(value: number, width: number): number {
  return Math.floor(value / 256 ** (width - 1));
}
