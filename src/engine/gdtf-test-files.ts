// Builders for small in-memory .gdtf files, for tests.
import { strToU8, zipSync } from 'fflate';

// A .gdtf archive holding `description.xml` around the given FixtureType
// attributes and DMXModes.
export function gdtf(fixtureType: Record<string, string>, ...modes: string[]): Uint8Array {
  return gdtfWith(fixtureType, {}, ...modes);
}

// As `gdtf`, with Wheel elements from `wheel`.
export function gdtfWithWheels(
  fixtureType: Record<string, string>,
  wheels: string[],
  ...modes: string[]
): Uint8Array {
  return gdtfWith(fixtureType, { wheels }, ...modes);
}

// As `gdtf`, with top-level geometries from `geometry`.
export function gdtfWithGeometries(
  fixtureType: Record<string, string>,
  geometries: string[],
  ...modes: string[]
): Uint8Array {
  return gdtfWith(fixtureType, { geometries }, ...modes);
}

function gdtfWith(
  fixtureType: Record<string, string>,
  { wheels = [], geometries = [] }: { wheels?: string[]; geometries?: string[] },
  ...modes: string[]
): Uint8Array {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<GDTF DataVersion="1.1">
  <FixtureType ${attributes(fixtureType)}>
    <Wheels>${wheels.join('')}</Wheels>
    <Geometries>${geometries.join('')}</Geometries>
    <DMXModes>${modes.join('')}</DMXModes>
  </FixtureType>
</GDTF>`;
  return zipSync({ 'description.xml': strToU8(xml) });
}

export function mode(name: string, ...channels: string[]): string {
  return `<DMXMode Name="${name}" Geometry="Body"><DMXChannels>${channels.join('')}</DMXChannels></DMXMode>`;
}

// A DMXChannel with one LogicalChannel. `dmx` is its Offset, or all its XML
// attributes; an absent Offset makes a virtual channel.
export function channel(
  dmx: string | Record<string, string>,
  attribute: string,
  ...functions: string[]
): string {
  const values = typeof dmx === 'string' ? { Offset: dmx } : dmx;
  return `<DMXChannel ${attributes({ DMXBreak: '1', Geometry: 'Body', ...values })}><LogicalChannel Attribute="${attribute}">${functions.join('')}</LogicalChannel></DMXChannel>`;
}

export function channelFunction(
  attribute: string,
  dmxFrom: string,
  extra: Record<string, string> = {},
  ...sets: string[]
): string {
  return `<ChannelFunction ${attributes({ Name: attribute, Attribute: attribute, DMXFrom: dmxFrom, ...extra })}>${sets.join('')}</ChannelFunction>`;
}

function attributes(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');
}

export function channelSet(
  name: string,
  dmxFrom: string,
  extra: Record<string, string> = {},
): string {
  return `<ChannelSet ${attributes({ Name: name, DMXFrom: dmxFrom, ...extra })}/>`;
}

// A Wheel with one Slot per [name, CIE colour] pair.
export function wheel(name: string, ...slots: [string, string][]): string {
  const slotElements = slots.map(
    ([slotName, colour]) => `<Slot ${attributes({ Name: slotName, Color: colour })}/>`,
  );
  return `<Wheel Name="${name}">${slotElements.join('')}</Wheel>`;
}

// A geometry element (`Geometry`, `Beam`, ...) holding child geometries.
export function geometry(element: string, name: string, ...children: string[]): string {
  return `<${element} Name="${name}">${children.join('')}</${element}>`;
}

// A GeometryReference to `geometry` with one Break per [DMXBreak, DMXOffset]
// pair.
export function geometryReference(
  name: string,
  geometry: string,
  ...breaks: [string, string][]
): string {
  const breakElements = breaks.map(
    ([dmxBreak, offset]) => `<Break ${attributes({ DMXBreak: dmxBreak, DMXOffset: offset })}/>`,
  );
  return `<GeometryReference Name="${name}" Geometry="${geometry}">${breakElements.join('')}</GeometryReference>`;
}

// A one-channel dimmer, as the smallest importable fixture.
export function gdtfDimmer(manufacturer: string, name: string, modeName = '1ch'): Uint8Array {
  return gdtf(
    { Manufacturer: manufacturer, Name: name },
    mode(modeName, channel('1', 'Dimmer', channelFunction('Dimmer', '0/1'))),
  );
}
