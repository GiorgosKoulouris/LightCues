import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { Emitter } from '../shared/fixture-profile';
import { importGdtfFixture } from './gdtf-import';
import {
  channel,
  channelFunction,
  channelSet,
  gdtf,
  gdtfWithGeometries,
  gdtfWithWheels,
  geometry,
  geometryReference,
  mode,
  wheel,
} from './gdtf-test-files';

describe('importGdtfFixture', () => {
  it('imports a dimmer-only fixture', () => {
    const result = importGdtfFixture(
      gdtf(
        { Manufacturer: 'Generic', Name: 'Par 64 Dimmer' },
        mode('1ch', channel('1', 'Dimmer', channelFunction('Dimmer', '0/1'))),
      ),
    );

    expect(result).toEqual({
      profile: {
        id: 'generic/par-64-dimmer',
        manufacturer: 'Generic',
        model: 'Par 64 Dimmer',
        defaultRole: 'Wash',
        modes: [
          {
            name: '1ch',
            channels: [
              {
                kind: 'control',
                name: 'Dimmer',
                defaultValue: 0,
                ranges: [{ from: 0, to: 255, capability: { type: 'intensity' } }],
              },
            ],
          },
        ],
      },
      unsupported: [],
    });
  });

  it('imports 16-bit pan and tilt with fine channels, defaults and gaps', () => {
    const { profile, unsupported } = importGdtfFixture(
      gdtf(
        { Manufacturer: 'Generic', Name: 'Mover' },
        mode(
          '6ch',
          channel(
            '1,2',
            'Pan',
            channelFunction('Pan', '0/1', {
              Default: '32768/2',
              PhysicalFrom: '-270',
              PhysicalTo: '270',
            }),
          ),
          channel(
            '3,4',
            'Tilt',
            channelFunction('Tilt', '0/1', {
              Default: '128/1',
              PhysicalFrom: '-135',
              PhysicalTo: '135',
            }),
          ),
          channel('6', 'Dimmer', channelFunction('Dimmer', '0/1', { Default: '255/1' })),
        ),
      ),
    );

    expect(profile.modes[0]!.channels).toEqual([
      {
        kind: 'control',
        name: 'Pan',
        defaultValue: 128,
        ranges: [{ from: 0, to: 255, capability: { type: 'pan', degrees: [-270, 270] } }],
      },
      { kind: 'fine', name: 'Pan fine', of: 'Pan', byte: 1, defaultValue: 0 },
      {
        kind: 'control',
        name: 'Tilt',
        defaultValue: 128,
        ranges: [{ from: 0, to: 255, capability: { type: 'tilt', degrees: [-135, 135] } }],
      },
      // 128/1 mirrors into every byte of a 16-bit value.
      { kind: 'fine', name: 'Tilt fine', of: 'Tilt', byte: 1, defaultValue: 128 },
      { kind: 'unused' },
      {
        kind: 'control',
        name: 'Dimmer',
        defaultValue: 255,
        ranges: [{ from: 0, to: 255, capability: { type: 'intensity' } }],
      },
    ]);
    expect(unsupported).toEqual([]);
  });

  it('imports emitters, a shutter channel with strobe, and no-feature ranges', () => {
    const { profile, unsupported } = importGdtfFixture(
      gdtf(
        { Manufacturer: 'Generic', Name: 'LED Par' },
        mode(
          '6ch',
          channel('1', 'ColorAdd_R', channelFunction('ColorAdd_R', '0/1')),
          channel('2', 'ColorAdd_WW', channelFunction('ColorAdd_WW', '0/1')),
          channel('3', 'ColorRGB_Blue', channelFunction('ColorRGB_Blue', '0/1')),
          channel('4', 'ColorAdd_RY', channelFunction('ColorAdd_RY', '0/1')),
          channel(
            '5',
            'Shutter1',
            channelFunction(
              'Shutter1',
              '0/1',
              {},
              channelSet('Closed', '0/1'),
              channelSet('Open', '8/1'),
            ),
            channelFunction('Shutter1Strobe', '16/1', { PhysicalFrom: '1', PhysicalTo: '20' }),
            channelFunction('Shutter1', '240/1', {}, channelSet('Open', '240/1')),
          ),
          channel(
            '6',
            'Dimmer',
            channelFunction('NoFeature', '0/1'),
            channelFunction('Dimmer', '10/1'),
          ),
        ),
      ),
    );

    const [red, warmWhite, blue, amber, shutter, dimmer] = profile.modes[0]!.channels;
    expect(red).toMatchObject({ name: 'Red', ranges: [emitterRange('red')] });
    expect(warmWhite).toMatchObject({ name: 'Warm White', ranges: [emitterRange('warmWhite')] });
    expect(blue).toMatchObject({ name: 'Blue', ranges: [emitterRange('blue')] });
    expect(amber).toMatchObject({ name: 'Amber', ranges: [emitterRange('amber')] });
    expect(shutter).toMatchObject({
      name: 'Shutter1',
      ranges: [
        { from: 0, to: 7, capability: { type: 'shutter', effect: 'closed' } },
        { from: 8, to: 15, capability: { type: 'shutter', effect: 'open' } },
        { from: 16, to: 239, capability: { type: 'strobe', hz: [1, 20] } },
        { from: 240, to: 255, capability: { type: 'shutter', effect: 'open' } },
      ],
    });
    expect(dimmer).toMatchObject({
      ranges: [
        { from: 0, to: 9, capability: { type: 'none' } },
        { from: 10, to: 255, capability: { type: 'intensity' } },
      ],
    });
    expect(unsupported).toEqual([]);
  });

  it('reads shutter sets without Open or Closed in their name from the function', () => {
    // As in the FOS Wash LED Quad III: an "Off" set and an unnamed set.
    const { profile, unsupported } = importGdtfFixture(
      gdtf(
        { Manufacturer: 'Generic', Name: 'Wash' },
        mode(
          '2ch',
          channel(
            '1',
            'Shutter1',
            channelFunction(
              'Shutter1',
              '0/1',
              { Name: 'Shutter Open' },
              channelSet('Off', '0/1'),
              channelSet('', '1/1'),
            ),
            channelFunction('Shutter1Strobe', '4/1', { PhysicalFrom: '0', PhysicalTo: '15' }),
          ),
          channel(
            '2',
            'Shutter2',
            channelFunction(
              'Shutter2',
              '0/1',
              { PhysicalFrom: '0', PhysicalTo: '0' },
              channelSet('', '0/1'),
            ),
            channelFunction(
              'Shutter2',
              '128/1',
              { PhysicalFrom: '1', PhysicalTo: '1' },
              channelSet('', '128/1'),
            ),
          ),
        ),
      ),
    );

    const [shutter1, shutter2] = profile.modes[0]!.channels;
    expect(shutter1).toMatchObject({
      ranges: [
        { from: 0, to: 3, capability: { type: 'shutter', effect: 'open' } },
        { from: 4, to: 255, capability: { type: 'strobe', hz: [0, 15] } },
      ],
    });
    expect(shutter2).toMatchObject({
      ranges: [
        { from: 0, to: 127, capability: { type: 'shutter', effect: 'closed' } },
        { from: 128, to: 255, capability: { type: 'shutter', effect: 'open' } },
      ],
    });
    expect(unsupported).toEqual([]);
  });

  it('reports unmapped attributes and virtual channels instead of dropping them', () => {
    const { profile, unsupported } = importGdtfFixture(
      gdtf(
        { Manufacturer: 'Generic', Name: 'Spot' },
        mode(
          'Basic',
          channel('1', 'Zoom', channelFunction('Zoom', '0/1')),
          channel(
            '2',
            'Shutter1',
            channelFunction(
              'Shutter1',
              '0/1',
              {},
              channelSet('Open', '0/1'),
              channelSet('Pulse', '128/1'),
            ),
          ),
          channel({}, 'Dimmer', channelFunction('Dimmer', '0/1')),
        ),
      ),
    );

    expect(profile.modes[0]!.channels).toEqual([
      {
        kind: 'control',
        name: 'Zoom',
        defaultValue: 0,
        ranges: [{ from: 0, to: 255, capability: { type: 'unsupported', feature: 'Zoom' } }],
      },
      {
        kind: 'control',
        name: 'Shutter1',
        defaultValue: 0,
        ranges: [
          { from: 0, to: 127, capability: { type: 'shutter', effect: 'open' } },
          { from: 128, to: 255, capability: { type: 'unsupported', feature: 'Shutter1 Pulse' } },
        ],
      },
    ]);
    expect(unsupported).toEqual([
      { channel: 'Zoom', feature: 'Zoom' },
      { channel: 'Shutter1', feature: 'Shutter1 Pulse' },
      { channel: 'Dimmer', mode: 'Basic', feature: 'Virtual channel' },
    ]);
  });

  it('imports one mode per DMX mode, keeping functions that apply together', () => {
    const modeDependent = { ModeMaster: 'Body_Control', ModeFrom: '128/1', ModeTo: '255/1' };
    const { profile, unsupported } = importGdtfFixture(
      gdtf(
        { Manufacturer: 'Generic', Name: 'Par', LongName: 'Generic LED Par' },
        mode('1ch', channel('1', 'Dimmer', channelFunction('Dimmer', '0/1'))),
        mode(
          '2ch',
          channel(
            '1',
            'Dimmer',
            channelFunction('Dimmer', '0/1'),
            channelFunction('Shutter1Strobe', '0/1', modeDependent),
          ),
          channel('2', 'Control', channelFunction('NoFeature', '0/1')),
        ),
      ),
    );

    expect(profile.model).toBe('Par');
    expect(profile.modes.map((m) => [m.name, m.channels.length])).toEqual([
      ['1ch', 1],
      ['2ch', 2],
    ]);
    expect(profile.modes[1]!.channels[0]).toMatchObject({
      ranges: [{ from: 0, to: 255, capability: { type: 'intensity' } }],
    });
    expect(unsupported).toEqual([
      { channel: 'Dimmer', feature: 'Mode-dependent channel functions' },
    ]);
  });

  it('reports channels it cannot place instead of overwriting slots', () => {
    const { profile, unsupported } = importGdtfFixture(
      gdtf(
        { Manufacturer: 'Generic', Name: 'Bar' },
        mode(
          '3ch',
          channel('1', 'Dimmer', channelFunction('Dimmer', '0/1')),
          channel('2', 'Dimmer', channelFunction('Dimmer', '0/1')),
          channel({ Offset: '1', DMXBreak: '2' }, 'Zoom', channelFunction('Zoom', '0/1')),
          channel('x', 'Focus', channelFunction('Focus', '0/1')),
        ),
      ),
    );

    expect(profile.modes[0]!.channels.map((c) => c.kind !== 'unused' && c.name)).toEqual([
      'Dimmer',
      'Dimmer 2',
    ]);
    expect(unsupported).toEqual([
      { channel: 'Focus', mode: '3ch', feature: 'Invalid DMX offset "x"' },
      { mode: '3ch', feature: 'DMX break 2 (1 channel)' },
    ]);
  });

  it('rejects a file that is not a GDTF archive', () => {
    expect(() => importGdtfFixture(new TextEncoder().encode('{"name": "Par"}'))).toThrow(
      'Not a GDTF file',
    );
    expect(() => importGdtfFixture(zipSync({ 'model.3ds': new Uint8Array(1) }))).toThrow(
      'Not a GDTF file: description.xml is missing',
    );
    expect(() => importGdtfFixture(zipSync({ 'description.xml': strToU8('<Fixture/>') }))).toThrow(
      'Not a GDTF file: description.xml has no FixtureType',
    );
  });

  it('reads the GDTF 1.0 default value from the DMX channel', () => {
    const { profile } = importGdtfFixture(
      gdtf(
        { Manufacturer: 'Generic', Name: 'Par' },
        mode(
          '1ch',
          channel({ Offset: '1', Default: '64/1' }, 'Dimmer', channelFunction('Dimmer', '0/1')),
        ),
      ),
    );

    expect(profile.modes[0]!.channels[0]).toMatchObject({ defaultValue: 64 });
  });

  it('imports colour wheel slots with names and colours from the wheel', () => {
    const { profile, unsupported } = importGdtfFixture(
      gdtfWithWheels(
        { Manufacturer: 'Generic', Name: 'Spot' },
        [
          wheel(
            'Colour Wheel',
            ['open', '0.3127,0.3290,100'],
            ['Red', '0.64,0.33,12'],
            ['Deep Blue', '0.15,0.06,3'],
          ),
          wheel('Gobos', ['Open', '0.3127,0.3290,100']),
        ],
        mode(
          '2ch',
          channel(
            '1',
            'Color1',
            channelFunction(
              'Color1',
              '0/1',
              { Wheel: 'Colour Wheel' },
              channelSet('Open', '0/1', { WheelSlotIndex: '1' }),
              channelSet('Open/Red', '10/1'),
              channelSet('Red/Blue', '25/1', { WheelSlotIndex: '0' }),
              channelSet('', '20/1', { WheelSlotIndex: '2' }),
              channelSet('Blue', '30/1', { WheelSlotIndex: '3' }),
              channelSet('Beyond', '100/1', { WheelSlotIndex: '4' }),
            ),
            channelFunction('Color1WheelSpin', '128/1', { Wheel: 'Colour Wheel' }),
            channelFunction('Color1WheelRandom', '200/1', { Wheel: 'Colour Wheel' }),
          ),
          channel(
            '2',
            'Gobo1',
            channelFunction(
              'Gobo1',
              '0/1',
              { Wheel: 'Gobos' },
              channelSet('Open', '0/1', { WheelSlotIndex: '1' }),
            ),
          ),
        ),
      ),
    );

    const slot = (name: string, colour: string) => ({ type: 'wheelSlot', slot: { name, colour } });
    expect(profile.modes[0]!.channels).toEqual([
      {
        kind: 'control',
        name: 'Color1',
        defaultValue: 0,
        ranges: [
          { from: 0, to: 9, capability: slot('Open', '#ffffff') },
          {
            from: 10,
            to: 19,
            capability: { type: 'unsupported', feature: 'Color1 between slots' },
          },
          { from: 20, to: 24, capability: slot('Red', '#ff0000') },
          {
            from: 25,
            to: 29,
            capability: { type: 'unsupported', feature: 'Color1 between slots' },
          },
          { from: 30, to: 99, capability: slot('Deep Blue', '#0000ff') },
          {
            from: 100,
            to: 127,
            capability: { type: 'unsupported', feature: 'Color1 missing wheel slot' },
          },
          { from: 128, to: 199, capability: { type: 'unsupported', feature: 'Color1WheelSpin' } },
          { from: 200, to: 255, capability: { type: 'unsupported', feature: 'Color1WheelRandom' } },
        ],
      },
      {
        kind: 'control',
        name: 'Gobo1',
        defaultValue: 0,
        ranges: [{ from: 0, to: 255, capability: { type: 'unsupported', feature: 'Gobo1' } }],
      },
    ]);
    expect(unsupported.map((u) => u.feature)).toEqual([
      'Color1 between slots',
      'Color1 missing wheel slot',
      'Color1WheelSpin',
      'Color1WheelRandom',
      'Gobo1',
    ]);
  });

  it('keeps a colour wheel function without a known wheel unsupported', () => {
    const { profile } = importGdtfFixture(
      gdtf(
        { Manufacturer: 'Generic', Name: 'Spot' },
        mode(
          '1ch',
          channel(
            '1',
            'Color1',
            channelFunction(
              'Color1',
              '0/1',
              { Wheel: 'Nowhere' },
              channelSet('Open', '0/1', { WheelSlotIndex: '1' }),
            ),
          ),
        ),
      ),
    );

    expect(profile.modes[0]!.channels[0]).toMatchObject({
      ranges: [
        {
          from: 0,
          to: 255,
          capability: { type: 'unsupported', feature: 'Color1 missing wheel slot' },
        },
      ],
    });
  });

  it('flattens a multi-cell fixture into one channel per cell', () => {
    // As the FOS Wash LED Quad III: a moving head wash, 16 channels, three
    // RGBW sections.
    const cellChannel = (offset: string, attribute: string) =>
      channel(
        { Offset: offset, Geometry: 'SectionBeam' },
        attribute,
        channelFunction(attribute, '0/1'),
      );
    const { profile, unsupported } = importGdtfFixture(
      gdtfWithGeometries(
        { Manufacturer: 'FOS', Name: 'Wash LED Quad III' },
        [
          geometry(
            'Geometry',
            'Body',
            geometryReference('Section 1', 'Section', ['1', '4']),
            geometryReference('Section 2', 'Section', ['1', '8']),
            geometryReference('Section 3', 'Section', ['1', '12']),
          ),
          geometry('Geometry', 'Section', geometry('Beam', 'SectionBeam')),
        ],
        mode(
          '16ch',
          channel('1', 'Pan', channelFunction('Pan', '0/1')),
          channel('2', 'Tilt', channelFunction('Tilt', '0/1')),
          channel('3', 'Dimmer', channelFunction('Dimmer', '0/1')),
          cellChannel('1', 'ColorAdd_R'),
          cellChannel('2', 'ColorAdd_G'),
          cellChannel('3', 'ColorAdd_B'),
          cellChannel('4', 'ColorAdd_W'),
          channel('16', 'ColorMacro1', channelFunction('ColorMacro1', '0/1')),
        ),
      ),
    );

    const channels = profile.modes[0]!.channels;
    expect(channels.map((c) => c.kind !== 'unused' && c.name)).toEqual([
      'Pan',
      'Tilt',
      'Dimmer',
      ...[1, 2, 3].flatMap((cell) =>
        ['Red', 'Green', 'Blue', 'White'].map((colour) => `${colour} (Cell ${cell})`),
      ),
      'ColorMacro1',
    ]);
    expect(channels[3]).toEqual({
      kind: 'control',
      name: 'Red (Cell 1)',
      defaultValue: 0,
      ranges: [emitterRange('red')],
    });
    expect(channels[14]).toMatchObject({ name: 'White (Cell 3)', ranges: [emitterRange('white')] });
    expect(unsupported).toEqual([{ channel: 'ColorMacro1', feature: 'ColorMacro1' }]);
    expect(profile.defaultRole).toBe('Wash');
  });

  it('numbers cells in reference order and gives each cell its fine channel', () => {
    const { profile } = importGdtfFixture(
      gdtfWithGeometries(
        { Manufacturer: 'Generic', Name: 'Pixel Pair' },
        [
          geometry(
            'Geometry',
            'Body',
            geometry(
              'Axis',
              'Yoke',
              geometryReference('Pixel A', 'Pixel', ['1', '5']),
              geometryReference('Pixel B', 'Pixel', ['1', '1']),
            ),
          ),
          geometry('Geometry', 'Pixel'),
        ],
        mode(
          '6ch',
          // The cell's Break gives the DMX break of an Overwrite channel.
          channel(
            { Offset: '1,2', Geometry: 'Pixel', DMXBreak: 'Overwrite' },
            'Dimmer',
            channelFunction('Dimmer', '0/1', { Default: '65535/2' }),
          ),
        ),
      ),
    );

    expect(profile.modes[0]!.channels).toEqual([
      expect.objectContaining({ kind: 'control', name: 'Dimmer (Cell 2)' }),
      {
        kind: 'fine',
        name: 'Dimmer (Cell 2) fine',
        of: 'Dimmer (Cell 2)',
        byte: 1,
        defaultValue: 255,
      },
      { kind: 'unused' },
      { kind: 'unused' },
      expect.objectContaining({ kind: 'control', name: 'Dimmer (Cell 1)', defaultValue: 255 }),
      {
        kind: 'fine',
        name: 'Dimmer (Cell 1) fine',
        of: 'Dimmer (Cell 1)',
        byte: 1,
        defaultValue: 255,
      },
    ]);
  });

  it('keeps main geometry channels plain and reports a cell with a bad DMXOffset', () => {
    const { profile, unsupported } = importGdtfFixture(
      gdtfWithGeometries(
        { Manufacturer: 'Generic', Name: 'Odd Bar' },
        [
          geometry(
            'Geometry',
            'Body',
            geometry('Beam', 'Beam'),
            geometryReference('Pixel A', 'Pixel', ['1', '2']),
            geometryReference('Pixel B', 'Pixel', ['1', 'x']),
          ),
          // A Beam of the same name as the main one.
          geometry('Geometry', 'Pixel', geometry('Beam', 'Beam'), geometry('Beam', 'Lens')),
        ],
        mode(
          '2ch',
          channel({ Offset: '1', Geometry: 'Beam' }, 'Dimmer', channelFunction('Dimmer', '0/1')),
          channel({ Offset: '1', Geometry: 'Lens' }, 'Zoom', channelFunction('Zoom', '0/1')),
        ),
      ),
    );

    expect(profile.modes[0]!.channels.map((c) => c.kind !== 'unused' && c.name)).toEqual([
      'Dimmer',
      'Zoom (Cell 1)',
    ]);
    expect(unsupported).toEqual([
      { channel: 'Zoom (Cell 1)', feature: 'Zoom' },
      { channel: 'Zoom (Cell 2)', mode: '2ch', feature: 'Invalid DMXOffset in cell 2' },
    ]);
  });

  it('imports the lowest DMX break and reports each other break once', () => {
    const { profile, unsupported } = importGdtfFixture(
      gdtfWithGeometries(
        { Manufacturer: 'Generic', Name: 'Split Bar' },
        [
          geometry(
            'Geometry',
            'Body',
            geometryReference('Pixel A', 'Pixel', ['1', '2'], ['2', '1']),
            geometryReference('Pixel B', 'Pixel', ['1', '4'], ['2', '4']),
            geometryReference('Pixel C', 'Pixel', ['1', '6']),
          ),
          geometry('Geometry', 'Pixel'),
        ],
        mode(
          'Split',
          channel('1', 'Dimmer', channelFunction('Dimmer', '0/1')),
          channel({ Offset: '1,2', Geometry: 'Pixel' }, 'Tilt', channelFunction('Tilt', '0/1')),
          channel(
            { Offset: '1,2,3', Geometry: 'Pixel', DMXBreak: '2' },
            'ColorAdd_R',
            channelFunction('ColorAdd_R', '0/1'),
          ),
          channel({ Offset: '7', DMXBreak: '3' }, 'Zoom', channelFunction('Zoom', '0/1')),
        ),
      ),
    );

    expect(profile.modes[0]!.channels.map((c) => c.kind !== 'unused' && c.name)).toEqual([
      'Dimmer',
      'Tilt (Cell 1)',
      'Tilt (Cell 1) fine',
      'Tilt (Cell 2)',
      'Tilt (Cell 2) fine',
      'Tilt (Cell 3)',
      'Tilt (Cell 3) fine',
    ]);
    expect(unsupported).toEqual([
      { channel: 'Red (Cell 3)', mode: 'Split', feature: 'No Break for DMX break 2 in cell 3' },
      { mode: 'Split', feature: 'DMX break 2 (6 channels)' },
      { mode: 'Split', feature: 'DMX break 3 (1 channel)' },
    ]);
  });

  it('takes the lowest break from placed channels and counts each slot once', () => {
    const { profile, unsupported } = importGdtfFixture(
      gdtf(
        { Manufacturer: 'Generic', Name: 'Remote Mover' },
        mode(
          'Remote',
          // A virtual channel takes no slot, so it sets no break.
          channel({ Offset: 'None' }, 'Dimmer', channelFunction('Dimmer', '0/1')),
          channel({ Offset: '1', DMXBreak: '2' }, 'Pan', channelFunction('Pan', '0/1')),
          channel({ Offset: '2', DMXBreak: '2' }, 'Tilt', channelFunction('Tilt', '0/1')),
          channel({ Offset: '1', DMXBreak: '3' }, 'Zoom', channelFunction('Zoom', '0/1')),
          channel({ Offset: '1', DMXBreak: '3' }, 'Focus', channelFunction('Focus', '0/1')),
          channel({ Offset: 'x', DMXBreak: '3' }, 'Iris', channelFunction('Iris', '0/1')),
        ),
      ),
    );

    expect(profile.modes[0]!.channels.map((c) => c.kind !== 'unused' && c.name)).toEqual([
      'Pan',
      'Tilt',
    ]);
    expect(unsupported).toEqual([
      { channel: 'Dimmer', mode: 'Remote', feature: 'Virtual channel' },
      { channel: 'Iris', mode: 'Remote', feature: 'Invalid DMX offset "x"' },
      { mode: 'Remote', feature: 'DMX break 3 (1 channel)' },
    ]);
  });
});

describe('GDTF default Role', () => {
  it('is Spot/Beam for a fixture with pan, tilt and a gobo wheel', () => {
    expect(roleOf('Pan', 'Tilt', 'Gobo1', 'Dimmer')).toBe('Spot/Beam');
    expect(roleOf('Pan', 'Tilt', 'Prism1', 'Dimmer')).toBe('Spot/Beam');
  });

  it('is Wash for a fixture with pan and tilt but no gobo or prism, even with cells', () => {
    expect(roleOf('Pan', 'Tilt', 'Dimmer', 'ColorAdd_R')).toBe('Wash');
    expect(roleOfCells(3, ['ColorAdd_R'], 'Pan', 'Tilt')).toBe('Wash');
    // A motor is not pan or tilt.
    expect(roleOfCells(3, ['ColorAdd_R'], 'PanRotate')).toBe('Pixel/Bar');
  });

  it('is Strobe for a fixture with only shutter, strobe and dimmer channels', () => {
    expect(roleOf('Dimmer', 'Shutter1Strobe', 'Shutter1')).toBe('Strobe');
    expect(roleOf('Shutter1Strobe', 'NoFeature')).toBe('Strobe');
    expect(roleOf('Dimmer', 'StrobeRate', 'StrobeDuration', 'Control1')).toBe('Strobe');
    // Programs and their speed do not make it a Wash.
    expect(roleOf('Dimmer', 'Shutter1Strobe', 'Effects1', 'EffectsRate', 'GlobalMSpeed')).toBe(
      'Strobe',
    );
    // Without a shutter it is not a strobe.
    expect(roleOf('Dimmer')).toBe('Wash');
    expect(roleOf('Dimmer', 'Shutter1Strobe', 'ColorAdd_W')).toBe('Wash');
  });

  it('is Effect for a haze, fog or fan machine with no emitters or dimmer', () => {
    expect(roleOf('Haze1', 'Fans')).toBe('Effect');
    expect(roleOf('Fog1', 'FogType1', 'Control1')).toBe('Effect');
    expect(roleOf('Blower1')).toBe('Effect');
    expect(roleOf('Fog1', 'Dimmer')).toBe('Wash');
    expect(roleOf('Fog1', 'HSB_Hue', 'HSB_Saturation')).toBe('Wash');
    expect(roleOf('Haze1', 'ColorSub_C', 'ColorSub_M', 'ColorSub_Y')).toBe('Wash');
    expect(roleOf('Fog1', 'ColorAdd_R', 'ColorAdd_G', 'ColorAdd_B')).toBe('Wash');
  });

  it('is Pixel/Bar for a fixture with more than one cell', () => {
    expect(roleOfCells(2, ['ColorAdd_R', 'ColorAdd_G', 'ColorAdd_B'])).toBe('Pixel/Bar');
  });

  it('counts cells across geometries', () => {
    const { profile } = importGdtfFixture(
      gdtfWithGeometries(
        { Manufacturer: 'Generic', Name: 'Two Part Bar' },
        [
          geometry(
            'Geometry',
            'Body',
            geometryReference('Left', 'LeftCell', ['1', '1']),
            geometryReference('Right', 'RightCell', ['1', '2']),
          ),
          geometry('Geometry', 'LeftCell'),
          geometry('Geometry', 'RightCell'),
        ],
        mode(
          '2ch',
          channel(
            { Offset: '1', Geometry: 'LeftCell' },
            'Dimmer',
            channelFunction('Dimmer', '0/1'),
          ),
          channel(
            { Offset: '1', Geometry: 'RightCell' },
            'Dimmer',
            channelFunction('Dimmer', '0/1'),
          ),
        ),
      ),
    );

    expect(profile.defaultRole).toBe('Pixel/Bar');
  });

  it('is Wash when no other rule matches', () => {
    expect(roleOf('Zoom', 'Focus1', 'ColorMacro1')).toBe('Wash');
    expect(
      importGdtfFixture(gdtf({ Manufacturer: 'Generic', Name: 'Empty' })).profile.defaultRole,
    ).toBe('Wash');
  });

  // The first of equally large modes counts.
  it('reads the attributes of the largest mode', () => {
    const { profile } = importGdtfFixture(
      gdtf(
        { Manufacturer: 'Generic', Name: 'Mover' },
        mode('1ch', channel('1', 'Dimmer', channelFunction('Dimmer', '0/1'))),
        mode(
          '4ch',
          channel('1', 'Pan', channelFunction('Pan', '0/1')),
          channel('2', 'Tilt', channelFunction('Tilt', '0/1')),
          channel('3', 'Gobo1', channelFunction('Gobo1', '0/1')),
          channel('4', 'Dimmer', channelFunction('Dimmer', '0/1')),
        ),
        mode(
          '4ch strobe',
          channel('1', 'Dimmer', channelFunction('Dimmer', '0/1')),
          channel('2,3,4', 'Shutter1', channelFunction('Shutter1Strobe', '0/1')),
        ),
      ),
    );

    expect(profile.defaultRole).toBe('Spot/Beam');
  });

  it('is Wash for stand-ins of the ADJ Mini Dekker and FOS Wash LED Quad III', () => {
    // Stand-ins: an RGBW effect light with a motor (9ch), and a moving head
    // wash with three RGBW sections (16ch).
    expect(
      roleOf(
        'ColorAdd_R',
        'ColorAdd_G',
        'ColorAdd_B',
        'ColorAdd_W',
        'ColorMacro1',
        'Shutter1Strobe',
        'BeamEffectIndexRotate1',
        'Effects1',
        'Dimmer',
      ),
    ).toBe('Wash');
    expect(
      roleOfCells(
        3,
        ['ColorAdd_R', 'ColorAdd_G', 'ColorAdd_B', 'ColorAdd_W'],
        'Pan',
        'Tilt',
        'Dimmer',
        'Shutter1',
      ),
    ).toBe('Wash');
  });
});

// The default Role of a one-mode fixture with one channel per attribute.
function roleOf(...attributes: string[]) {
  return roleOfCells(0, [], ...attributes);
}

// As `roleOf`, followed by `cells` cells with one channel per cell attribute.
function roleOfCells(cells: number, cellAttributes: string[], ...attributes: string[]) {
  const dmxChannel = (offset: number, geometry: string, attribute: string) =>
    channel(
      { Offset: `${offset}`, Geometry: geometry },
      attribute,
      channelFunction(attribute, '0/1'),
    );
  const references = Array.from({ length: cells }, (_, i) =>
    geometryReference(`Cell ${i + 1}`, 'Cell', [
      '1',
      `${attributes.length + i * cellAttributes.length + 1}`,
    ]),
  );
  return importGdtfFixture(
    gdtfWithGeometries(
      { Manufacturer: 'Generic', Name: 'Test' },
      [geometry('Geometry', 'Body', ...references), geometry('Geometry', 'Cell')],
      mode(
        'test',
        ...attributes.map((attribute, i) => dmxChannel(i + 1, 'Body', attribute)),
        ...cellAttributes.map((attribute, i) => dmxChannel(i + 1, 'Cell', attribute)),
      ),
    ),
  ).profile.defaultRole;
}

function emitterRange(emitter: Emitter) {
  return { from: 0, to: 255, capability: { type: 'emitter', emitter } };
}
