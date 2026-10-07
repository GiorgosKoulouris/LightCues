import { describe, expect, it } from 'vitest';
import type { Channel, Emitter } from '../shared/fixture-profile';
import { importOflFixture } from './ofl-import';

const meta = { authors: ['test'], createDate: '2026-01-01', lastModifyDate: '2026-01-01' };

describe('importOflFixture', () => {
  it('imports a dimmer-only fixture', () => {
    const result = importOflFixture(
      {
        name: 'Par 64 Dimmer',
        categories: ['Dimmer'],
        meta,
        availableChannels: { Dimmer: { capability: { type: 'Intensity' } } },
        modes: [{ name: '1ch', channels: ['Dimmer'] }],
      },
      'Generic',
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

  it('imports an RGB fixture with an unused channel and default values', () => {
    const { profile, unsupported } = importOflFixture(
      {
        name: 'LED Par RGB',
        categories: ['Color Changer'],
        meta,
        availableChannels: {
          Red: { defaultValue: 255, capability: { type: 'ColorIntensity', color: 'Red' } },
          Green: { defaultValue: '50%', capability: { type: 'ColorIntensity', color: 'Green' } },
          Blue: { capability: { type: 'ColorIntensity', color: 'Blue' } },
        },
        modes: [{ name: '4ch', channels: ['Red', 'Green', 'Blue', null] }],
      },
      'Generic',
    );

    expect(profile.defaultRole).toBe('Wash');
    expect(profile.modes[0]!.channels).toEqual([
      emitterChannel('Red', 'red', 255),
      emitterChannel('Green', 'green', 128),
      emitterChannel('Blue', 'blue', 0),
      { kind: 'unused' },
    ]);
    expect(unsupported).toEqual([]);
  });

  it('imports an RGBW fixture with a shutter and strobe channel', () => {
    const { profile, unsupported } = importOflFixture(
      {
        name: 'LED Par RGBW',
        categories: ['Color Changer', 'Strobe'],
        meta,
        availableChannels: {
          Dimmer: { capability: { type: 'Intensity' } },
          Red: { capability: { type: 'ColorIntensity', color: 'Red' } },
          Green: { capability: { type: 'ColorIntensity', color: 'Green' } },
          Blue: { capability: { type: 'ColorIntensity', color: 'Blue' } },
          White: { capability: { type: 'ColorIntensity', color: 'White' } },
          Strobe: {
            capabilities: [
              { dmxRange: [0, 9], type: 'ShutterStrobe', shutterEffect: 'Open' },
              { dmxRange: [10, 14], type: 'ShutterStrobe', shutterEffect: 'Closed' },
              {
                dmxRange: [15, 255],
                type: 'ShutterStrobe',
                shutterEffect: 'Strobe',
                speedStart: '1Hz',
                speedEnd: '20Hz',
              },
            ],
          },
        },
        modes: [{ name: '6ch', channels: ['Dimmer', 'Red', 'Green', 'Blue', 'White', 'Strobe'] }],
      },
      'Generic',
    );

    const [, ...rest] = profile.modes[0]!.channels;
    expect(rest.slice(0, 4)).toEqual([
      emitterChannel('Red', 'red', 0),
      emitterChannel('Green', 'green', 0),
      emitterChannel('Blue', 'blue', 0),
      emitterChannel('White', 'white', 0),
    ]);
    expect(rest[4]).toEqual({
      kind: 'control',
      name: 'Strobe',
      defaultValue: 0,
      ranges: [
        { from: 0, to: 9, capability: { type: 'shutter', effect: 'open' } },
        { from: 10, to: 14, capability: { type: 'shutter', effect: 'closed' } },
        { from: 15, to: 255, capability: { type: 'strobe', hz: [1, 20] } },
      ],
    });
    expect(unsupported).toEqual([]);
  });

  it('imports colour wheel slots from the wheel named by the channel', () => {
    const { profile, unsupported } = importOflFixture(
      {
        name: 'Wheel Spot',
        categories: ['Scanner'],
        meta,
        availableChannels: {
          'Color Wheel': {
            capabilities: [
              { dmxRange: [0, 9], type: 'WheelSlot', slotNumber: 1 },
              { dmxRange: [10, 19], type: 'WheelSlot', slotNumber: 2 },
              { dmxRange: [20, 255], type: 'WheelSlot', wheel: 'Color Wheel', slotNumber: 3 },
            ],
          },
        },
        wheels: {
          'Color Wheel': {
            slots: [
              { type: 'Open' },
              { type: 'Color', name: 'Red', colors: ['#ff0000'] },
              { type: 'Color', colors: ['#0000ff'] },
            ],
          },
        },
        modes: [{ name: '1ch', channels: ['Color Wheel'] }],
      },
      'Generic',
    );

    expect(profile.defaultRole).toBe('Spot/Beam');
    expect(profile.modes[0]!.channels[0]).toEqual({
      kind: 'control',
      name: 'Color Wheel',
      defaultValue: 0,
      ranges: [
        {
          from: 0,
          to: 9,
          capability: { type: 'wheelSlot', slot: { name: 'Open', colour: '#ffffff' } },
        },
        {
          from: 10,
          to: 19,
          capability: { type: 'wheelSlot', slot: { name: 'Red', colour: '#ff0000' } },
        },
        {
          from: 20,
          to: 255,
          capability: { type: 'wheelSlot', slot: { name: '#0000ff', colour: '#0000ff' } },
        },
      ],
    });
    expect(unsupported).toEqual([]);
  });

  it('imports a moving head with 16-bit pan and tilt', () => {
    const { profile, unsupported } = importOflFixture(
      {
        name: 'Beam 7R',
        categories: ['Moving Head'],
        meta,
        availableChannels: {
          Pan: {
            fineChannelAliases: ['Pan fine'],
            defaultValue: 32768,
            capability: { type: 'Pan', angleStart: '0deg', angleEnd: '540deg' },
          },
          Tilt: {
            fineChannelAliases: ['Tilt fine'],
            dmxValueResolution: '8bit',
            defaultValue: 128,
            capabilities: [
              { dmxRange: [0, 127], type: 'Tilt', angleStart: '0deg', angleEnd: '135deg' },
              { dmxRange: [128, 255], type: 'Tilt', angleStart: '135deg', angleEnd: '270deg' },
            ],
          },
          Dimmer: { capability: { type: 'Intensity' } },
        },
        modes: [
          { name: 'Basic', channels: ['Pan', 'Tilt', 'Dimmer'] },
          { name: 'Extended', channels: ['Pan', 'Pan fine', 'Tilt', 'Tilt fine', 'Dimmer'] },
        ],
      },
      'Generic',
    );

    const pan: Channel = {
      kind: 'control',
      name: 'Pan',
      defaultValue: 128,
      ranges: [{ from: 0, to: 255, capability: { type: 'pan', degrees: [0, 540] } }],
    };
    const tilt: Channel = {
      kind: 'control',
      name: 'Tilt',
      defaultValue: 128,
      ranges: [
        { from: 0, to: 127, capability: { type: 'tilt', degrees: [0, 135] } },
        { from: 128, to: 255, capability: { type: 'tilt', degrees: [135, 270] } },
      ],
    };
    expect(profile.defaultRole).toBe('Spot/Beam');
    expect(profile.modes[0]!.channels.slice(0, 2)).toEqual([pan, tilt]);
    expect(profile.modes[1]!.channels.slice(0, 4)).toEqual([
      pan,
      { kind: 'fine', name: 'Pan fine', of: 'Pan', byte: 1, defaultValue: 0 },
      tilt,
      { kind: 'fine', name: 'Tilt fine', of: 'Tilt', byte: 1, defaultValue: 0 },
    ]);
    expect(unsupported).toEqual([]);
  });

  it('reports unsupported features instead of dropping them', () => {
    const { profile, unsupported } = importOflFixture(
      {
        name: 'Feature Spot',
        categories: ['Moving Head'],
        meta,
        availableChannels: {
          'Gobo Wheel': {
            capabilities: [
              { dmxRange: [0, 9], type: 'NoFunction' },
              { dmxRange: [10, 19], type: 'WheelSlot', slotNumber: 1 },
              { dmxRange: [20, 29], type: 'WheelSlot', slotNumber: 1.5 },
              { dmxRange: [30, 255], type: 'WheelSlot', slotNumber: 2 },
            ],
          },
          Zoom: { capability: { type: 'Zoom', angleStart: '10deg', angleEnd: '40deg' } },
          Strobe: {
            capabilities: [
              { dmxRange: [0, 127], type: 'ShutterStrobe', shutterEffect: 'Open' },
              { dmxRange: [128, 255], type: 'ShutterStrobe', shutterEffect: 'Pulse' },
            ],
          },
          Mode: {
            defaultValue: 0,
            capabilities: [
              { dmxRange: [0, 127], type: 'NoFunction', switchChannels: { 'Speed/Zoom': 'Zoom' } },
              { dmxRange: [128, 255], type: 'NoFunction', switchChannels: { 'Speed/Zoom': null } },
            ],
          },
        },
        templateChannels: {
          'Red $pixelKey': { capability: { type: 'ColorIntensity', color: 'Red' } },
        },
        wheels: {
          'Gobo Wheel': { slots: [{ type: 'Open' }, { type: 'Gobo', name: 'Dots' }] },
        },
        modes: [
          { name: 'Direct pixel', channels: ['Red 1'] },
          { name: 'Standard', channels: ['Gobo Wheel', 'Zoom', 'Strobe', 'Mode', 'Speed/Zoom'] },
          {
            name: 'Pixel',
            channels: [
              'Strobe',
              {
                insert: 'matrixChannels',
                repeatFor: 'eachPixelABC',
                channelOrder: 'perPixel',
                templateChannels: ['Red $pixelKey'],
              },
            ],
          },
        ],
      },
      'Generic',
    );

    const standard = profile.modes.find((m) => m.name === 'Standard')!;
    expect(standard.channels).toHaveLength(5);
    expect(standard.channels[1]).toEqual({
      kind: 'control',
      name: 'Zoom',
      defaultValue: 0,
      ranges: [{ from: 0, to: 255, capability: { type: 'unsupported', feature: 'Zoom' } }],
    });
    expect(standard.channels[4]).toEqual({
      kind: 'control',
      name: 'Speed/Zoom',
      defaultValue: 0,
      ranges: [
        { from: 0, to: 255, capability: { type: 'unsupported', feature: 'Switching channel' } },
      ],
    });
    expect(profile.modes.map((m) => m.name)).toEqual(['Direct pixel', 'Standard']);
    expect(unsupported).toEqual([
      { channel: 'Gobo Wheel', feature: 'WheelSlot between slots' },
      { channel: 'Gobo Wheel', feature: 'WheelSlot Gobo' },
      { channel: 'Zoom', feature: 'Zoom' },
      { channel: 'Strobe', feature: 'ShutterStrobe Pulse' },
      { channel: 'Mode', feature: 'Switching channels' },
      { channel: 'Red 1', feature: 'Matrix channel' },
      { channel: 'Speed/Zoom', feature: 'Switching channel' },
      { mode: 'Pixel', feature: 'Matrix channels (mode not imported)' },
    ]);
  });

  it('rejects JSON that is not an OFL fixture', () => {
    expect(() => importOflFixture({ name: 'Not a fixture' }, 'Generic')).toThrow(
      'Not an Open Fixture Library fixture',
    );
    expect(() => importOflFixture(null, 'Generic')).toThrow('Not an Open Fixture Library fixture');
  });

  it('imports brightness ranges, including an inverted dimmer', () => {
    const { profile, unsupported } = importOflFixture(
      {
        name: 'Odd Dimmer',
        categories: ['Dimmer'],
        meta,
        availableChannels: {
          Dimmer: {
            capabilities: [
              { dmxRange: [0, 9], type: 'Intensity', brightness: 'off' },
              {
                dmxRange: [10, 255],
                type: 'Intensity',
                brightnessStart: '100%',
                brightnessEnd: '0%',
              },
            ],
          },
          Red: {
            capability: {
              type: 'ColorIntensity',
              color: 'Red',
              brightnessStart: 'off',
              brightnessEnd: 'bright',
            },
          },
        },
        modes: [{ name: '2ch', channels: ['Dimmer', 'Red'] }],
      },
      'Generic',
    );

    expect(profile.modes[0]!.channels).toEqual([
      {
        kind: 'control',
        name: 'Dimmer',
        defaultValue: 0,
        ranges: [
          { from: 0, to: 9, capability: { type: 'intensity', level: [0, 0] } },
          { from: 10, to: 255, capability: { type: 'intensity', level: [1, 0] } },
        ],
      },
      {
        kind: 'control',
        name: 'Red',
        defaultValue: 0,
        ranges: [
          { from: 0, to: 255, capability: { type: 'emitter', emitter: 'red', level: [0, 1] } },
        ],
      },
    ]);
    expect(unsupported).toEqual([]);
  });

  it('reports values it cannot place in its units', () => {
    const { profile, unsupported } = importOflFixture(
      {
        name: 'Vague Head',
        categories: ['Moving Head'],
        meta,
        availableChannels: {
          Pan: { capability: { type: 'Pan', angleStart: '0%', angleEnd: '100%' } },
          Strobe: { capability: { type: 'StrobeSpeed', speedStart: 'slow', speedEnd: 'fast' } },
          Dimmer: {
            capability: { type: 'Intensity', brightnessStart: 'dark', brightnessEnd: 'bright' },
          },
        },
        modes: [{ name: '3ch', channels: ['Pan', 'Strobe', 'Dimmer'] }],
      },
      'Generic',
    );

    expect(
      profile.modes[0]!.channels.map((c) => c.kind === 'control' && c.ranges[0]!.capability),
    ).toEqual([{ type: 'pan' }, { type: 'strobeSpeed' }, { type: 'intensity' }]);
    expect(unsupported).toEqual([
      { channel: 'Pan', feature: 'Pan angle not in degrees' },
      { channel: 'Strobe', feature: 'StrobeSpeed speed not in Hz' },
      { channel: 'Dimmer', feature: 'Intensity brightness not in %' },
    ]);
  });

  it.each([
    [['Dimmer'], 'Wash'],
    [['Color Changer'], 'Wash'],
    [['Moving Head', 'Color Changer'], 'Spot/Beam'],
    [['Scanner'], 'Spot/Beam'],
    [['Barrel Scanner'], 'Spot/Beam'],
    [['Blinder'], 'Blinder'],
    [['Strobe'], 'Strobe'],
    [['Pixel Bar'], 'Pixel/Bar'],
    [['Matrix'], 'Pixel/Bar'],
    [['Flower'], 'Effect'],
    [['Laser'], 'Effect'],
    [['Effect'], 'Effect'],
    [['Hazer'], 'Effect'],
    [['Other', 'Strobe'], 'Strobe'],
    [['Other'], 'Wash'],
  ])('takes the default Role from the first mapped category %j', (categories, role) => {
    const { profile } = importOflFixture(
      {
        name: 'Any',
        categories,
        meta,
        availableChannels: { Dimmer: { capability: { type: 'Intensity' } } },
        modes: [{ name: '1ch', channels: ['Dimmer'] }],
      },
      'Generic',
    );

    expect(profile.defaultRole).toBe(role);
  });
});

function emitterChannel(name: string, emitter: Emitter, defaultValue: number): Channel {
  return {
    kind: 'control',
    name,
    defaultValue,
    ranges: [{ from: 0, to: 255, capability: { type: 'emitter', emitter } }],
  };
}
