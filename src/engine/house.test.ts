import { describe, expect, it } from 'vitest';
import type { Channel, FixtureProfile } from '../shared/fixture-profile';
import type { EngineEvent } from '../shared/protocol';
import { emptyShow, type HousePreset, type Show } from '../shared/show';
import {
  emptyPatch,
  putHouseGroup,
  putHouseLight,
  setHouseLook,
  setStartupLook,
  type HouseLight,
  type HouseLook,
  type PatchResult,
  type VenuePatch,
} from '../shared/venue-patch';
import { createHouse, houseFrames, houseLevels } from './house';

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
  const frame = houseFrames(patch(), houseLevels(look), stage).get(1)!;
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

const dim: HouseLook = { bar: { intensity: 0.2, colour: { swatch: 'White' } } };
const red: HouseLook = { bar: { intensity: 1, colour: { swatch: 'Red' } } };
const blue: HouseLook = { bar: { intensity: 1, colour: { swatch: 'Blue' } } };

// A house with `patch()`'s House Lights, a Show with these House Presets and a
// patch with these house looks. `clock` is in milliseconds.
function firingHouse(
  presets: HousePreset[],
  looks: Record<string, HouseLook>,
  startup?: HouseLook,
) {
  let venue = patch();
  for (const [id, look] of Object.entries(looks)) venue = ok(setHouseLook(venue, id, look));
  if (startup) venue = ok(setStartupLook(venue, startup));
  const show: Show = { ...emptyShow(), housePresets: presets };
  const clock = { now: 0 };
  const events: EngineEvent[] = [];
  const h = createHouse({
    patch: () => venue,
    show: () => show,
    now: () => clock.now,
    emit: (e) => events.push(e),
  });
  h.venueReplaced();
  // Universe 1's channels 1–10 and 20 at `ms`.
  const at = (ms: number) => {
    clock.now = ms;
    const frame = h.frames(new Map()).get(1)!;
    return [...frame.slice(0, 10), frame[19]!];
  };
  return { house: h, events, at, clock };
}

const preset = (id: string, fade: number): HousePreset => ({ id, name: id, fade });

describe('firing House Presets', () => {
  it('crossfades the House Groups the look sets over the fade, leaving the others', () => {
    const { house, at } = firingHouse([preset('dim', 2)], { dim });

    house.fire('dim');

    // Bar's dimmer goes from 255 to 51; Ceiling stays at full.
    expect(at(0)[0]).toBe(255);
    expect(at(1000)[0]).toBe(153);
    expect(at(2000)[0]).toBe(51);
    expect(at(5000)[0]).toBe(51);
    expect(at(1000)[10]).toBe(255);
  });

  it('crossfades colour too', () => {
    const { house, at } = firingHouse([preset('red', 0), preset('blue', 2)], { red, blue });
    house.fire('red');

    house.fire('blue');

    // The RGB light at 2–4.
    expect(at(1000).slice(1, 4)).toEqual([128, 0, 128]);
    expect(at(2000).slice(1, 4)).toEqual([0, 0, 255]);
  });

  it('starts a fade from where the one before has got to', () => {
    const { house, at } = firingHouse([preset('dim', 2), preset('up', 2)], {
      dim,
      up: { bar: { intensity: 1, colour: { swatch: 'White' } } },
    });
    house.fire('dim');
    at(1000);

    house.fire('up');

    expect(at(1000)[0]).toBe(153);
    expect(at(2000)[0]).toBe(204);
    expect(at(3000)[0]).toBe(255);
  });

  it('goes at once with no fade', () => {
    const { house, at } = firingHouse([preset('dim', 0)], { dim });

    house.fire('dim');

    expect(at(0)[0]).toBe(51);
  });

  it('does nothing for a House Preset with no look, or not in the Show', () => {
    const { house, at, events } = firingHouse([preset('dim', 0), preset('up', 0)], {
      dim,
      gone: red,
    });
    events.length = 0;

    house.fire('up');
    house.fire('gone');
    house.fire('nope');

    expect(at(0)[0]).toBe(255);
    expect(events).toEqual([]);
  });

  it('reports what was fired last, from the start of its fade', () => {
    const { house, events } = firingHouse([preset('dim', 2)], { dim });
    expect(events).toEqual([{ type: 'house', fired: { type: 'startup' } }]);

    house.fire('dim');

    expect(events.at(-1)).toEqual({ type: 'house', fired: { type: 'preset', id: 'dim' } });
  });

  it('crossfades to the Startup look, the Groups it does not set to full white', () => {
    const startup: HouseLook = { ceiling: { intensity: 0, colour: { swatch: 'White' } } };
    const { house, at, events } = firingHouse([preset('dim', 0)], { dim }, startup);
    expect(at(0)[10]).toBe(0);
    house.fire('dim');
    at(0);

    house.goStartupLook();

    expect(at(1000)[0]).toBe(153);
    expect(at(2000)[0]).toBe(255);
    expect(at(2000)[10]).toBe(0);
    expect(events.at(-1)).toEqual({ type: 'house', fired: { type: 'startup' } });
  });

  it('goes to the Startup look at once when the Venue Patch is replaced', () => {
    const { house, at } = firingHouse([preset('dim', 2)], { dim });
    house.fire('dim');
    at(1000);

    house.venueReplaced();

    expect(at(1000)[0]).toBe(255);
  });

  it('shows a previewed look over a fade, which goes on underneath', () => {
    const { house, at } = firingHouse([preset('dim', 2)], { dim });
    house.fire('dim');

    house.preview(red);
    expect(at(1000)[0]).toBe(255);
    house.preview(undefined);

    expect(at(2000)[0]).toBe(51);
  });

  it('keeps the look it is going to and what was fired in its snapshot, fades done on restore', () => {
    const { house, at } = firingHouse([preset('dim', 2)], { dim });
    house.fire('dim');
    const snapshot = house.snapshot();
    expect(snapshot).toEqual({ look: dim, fired: { type: 'preset', id: 'dim' } });

    const { house: restarted, at: restartedAt, events } = firingHouse([], {});
    restarted.restore(snapshot);

    expect(at(0)[0]).toBe(255);
    expect(restartedAt(0)[0]).toBe(51);
    expect(events.at(-1)).toEqual({ type: 'house', fired: { type: 'preset', id: 'dim' } });
  });
});
