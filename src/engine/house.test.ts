import { describe, expect, it } from 'vitest';
import type { Channel, FixtureProfile } from '../shared/fixture-profile';
import {
  emptyPatch,
  putHouseGroup,
  putHouseLight,
  type HouseLight,
  type HouseLook,
  type PatchResult,
  type VenuePatch,
} from '../shared/venue-patch';
import { houseFrames } from './house';

const dimmerChannel: Channel = {
  kind: 'control',
  name: 'Dimmer',
  defaultValue: 0,
  ranges: [{ from: 0, to: 255, capability: { type: 'intensity' } }],
};

const rgbChannels: Channel[] = (['red', 'green', 'blue'] as const).map((emitter) => ({
  kind: 'control',
  name: emitter,
  defaultValue: 0,
  ranges: [{ from: 0, to: 255, capability: { type: 'emitter', emitter } }],
}));

// A House Light Profile in three modes: dimmer only, RGB only, and both. The
// last has a channel that intensity and colour do not set.
const house: FixtureProfile = {
  id: 'acme/house',
  manufacturer: 'Acme',
  model: 'House',
  defaultRole: 'Wash',
  modes: [
    { name: 'dimmer', channels: [dimmerChannel] },
    { name: 'rgb', channels: rgbChannels },
    {
      name: 'both',
      channels: [
        dimmerChannel,
        ...rgbChannels,
        {
          kind: 'control',
          name: 'Program',
          defaultValue: 7,
          ranges: [{ from: 0, to: 255, capability: { type: 'none' } }],
        },
      ],
    },
  ],
};

function light(id: string, mode: string, address: number, group = 'bar'): HouseLight {
  return { id, name: id, group, profileId: 'acme/house', mode, universe: 1, address };
}

// Bar holds a dimmer at 1, an RGB light at 2 and one with both at 5. Ceiling
// holds a dimmer at 20.
function patch(): VenuePatch {
  let result = ok(putHouseGroup(emptyPatch({ width: 10, depth: 8 }), { id: 'bar', name: 'Bar' }));
  result = ok(putHouseGroup(result, { id: 'ceiling', name: 'Ceiling' }));
  for (const l of [
    light('dimmer', 'dimmer', 1),
    light('rgb', 'rgb', 2),
    light('both', 'both', 5),
    light('top', 'dimmer', 20, 'ceiling'),
  ]) {
    result = ok(putHouseLight(result, l, house));
  }
  return result;
}

function ok(result: PatchResult): VenuePatch {
  if ('errors' in result) throw new Error(result.errors.join('\n'));
  return result.patch;
}

// Universe 1's channels 1–10 and 20 after the house look.
function channels(look: HouseLook, stage = new Map<number, Uint8Array>()): number[] {
  const frame = houseFrames(patch(), look, stage).get(1)!;
  return [...frame.slice(0, 10), frame[19]!];
}

describe('House Light output', () => {
  it('sends full white where the house state sets nothing', () => {
    expect(channels({})).toEqual([255, 255, 255, 255, 255, 255, 255, 255, 7, 0, 255]);
  });

  it('follows the stage Fixture rules for intensity and colour', () => {
    const look = { bar: { intensity: 0.5, colour: { swatch: 'Red' } } } as const;

    // Dimmer only: colour is ignored. RGB only: the colour is scaled. Both:
    // the dimmer carries intensity, RGB the colour, and other channels stay
    // at their defaults. Ceiling is not in the look, so stays at full white.
    expect(channels(look)).toEqual([128, 128, 0, 0, 128, 255, 0, 0, 7, 0, 255]);
  });

  it('writes over the stage frames, leaving the stage channels and the frames given alone', () => {
    const stage = new Uint8Array(512);
    stage[9] = 42;
    const frames = new Map([[1, stage]]);

    const sent = houseFrames(patch(), {}, frames).get(1)!;

    expect(sent[9]).toBe(42);
    expect(sent[0]).toBe(255);
    expect(stage[0]).toBe(0);
  });

  it('adds a frame for a Universe the stage frames lack', () => {
    expect(houseFrames(patch(), {}, new Map()).get(1)?.[0]).toBe(255);
  });

  it('returns the stage frames as they are with no House Lights', () => {
    const frames = new Map([[1, new Uint8Array(512)]]);

    expect(houseFrames(emptyPatch({ width: 10, depth: 8 }), {}, frames)).toBe(frames);
  });
});
