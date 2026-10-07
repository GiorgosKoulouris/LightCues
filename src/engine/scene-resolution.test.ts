import { describe, expect, it } from 'vitest';
import type {
  Capability,
  CapabilityRange,
  Channel,
  Emitter,
  FixtureProfile,
} from '../shared/fixture-profile';
import type { Rule, Scene, Show, Swatch } from '../shared/show';
import type { PatchedFixture, VenuePatch } from '../shared/venue-patch';
import { activate, clearLayer, resolveFrames, type ActiveScenes } from './scene-resolution';

// A 0–255 channel with one capability.
function channel(name: string, capability: Capability): Channel {
  return {
    kind: 'control',
    name,
    defaultValue: 0,
    ranges: [{ from: 0, to: 255, capability }],
  };
}

function profile(id: string, channels: Channel[]): FixtureProfile {
  return {
    id,
    manufacturer: 'Test',
    model: id,
    defaultRole: 'Wash',
    modes: [{ name: 'mode', channels }],
  };
}

const dimmer = profile('test/dimmer', [channel('Dimmer', { type: 'intensity' })]);

const emitter = (name: string, e: Emitter) => channel(name, { type: 'emitter', emitter: e });

const rgb = profile('test/rgb', [
  channel('Dimmer', { type: 'intensity' }),
  emitter('Red', 'red'),
  emitter('Green', 'green'),
  emitter('Blue', 'blue'),
]);

function fixture(overrides: Partial<PatchedFixture>): PatchedFixture {
  return {
    id: 'f1',
    name: 'Fixture',
    profileId: dimmer.id,
    mode: 'mode',
    universe: 1,
    address: 1,
    // Downstage Centre, Floor.
    x: 0,
    y: 1,
    height: 0,
    ...overrides,
  };
}

function patch(fixtures: PatchedFixture[], profiles: FixtureProfile[] = [dimmer]): VenuePatch {
  return { stage: { width: 12, depth: 9 }, universes: [{ number: 1 }], fixtures, profiles };
}

function scene(id: string, rules: Rule[], overrides: Partial<Scene> = {}): Scene {
  return { id, name: id, tags: [], layer: 'l1', fadeIn: 0, rules, ...overrides };
}

function show(...scenes: Scene[]): Show {
  return {
    layers: [
      { id: 'l1', name: 'Layer 1' },
      { id: 'l2', name: 'Layer 2' },
    ],
    scenes,
    triggers: [],
  };
}

// Activates the Scenes in order, each at its given time.
function play(s: Show, ...steps: [string, number][]): ActiveScenes {
  return steps.reduce<ActiveScenes>((active, [id, time]) => activate(active, s, id, time), {});
}

// The first `count` channels of Universe 1.
function channels(frames: Map<number, Uint8Array>, count: number): number[] {
  return [...frames.get(1)!.subarray(0, count)];
}

// No dimmer: intensity scales the emitters.
const rgbw = profile('test/rgbw', [
  emitter('Red', 'red'),
  emitter('Green', 'green'),
  emitter('Blue', 'blue'),
  emitter('White', 'white'),
]);

const rgbaw = profile('test/rgbaw', [
  channel('Dimmer', { type: 'intensity' }),
  emitter('Red', 'red'),
  emitter('Green', 'green'),
  emitter('Blue', 'blue'),
  emitter('Amber', 'amber'),
  emitter('White', 'white'),
]);

const rgbUv = profile('test/rgb-uv', [
  emitter('Red', 'red'),
  emitter('Green', 'green'),
  emitter('Blue', 'blue'),
  emitter('UV', 'uv'),
]);

const slot = (from: number, to: number, name: string, colour: string): CapabilityRange => ({
  from,
  to,
  capability: { type: 'wheelSlot', slot: { name, colour } },
});

const wheel = profile('test/wheel', [
  channel('Dimmer', { type: 'intensity' }),
  {
    kind: 'control',
    name: 'Colour',
    defaultValue: 0,
    ranges: [
      slot(0, 9, 'Open', '#ffffff'),
      slot(10, 19, 'Red', '#ff0000'),
      slot(20, 29, 'Blue', '#0000ff'),
      slot(30, 39, 'Green', '#00ff00'),
      { from: 40, to: 255, capability: { type: 'unsupported', feature: 'rotation' } },
    ],
  },
]);

describe('resolveFrames', () => {
  it('sets a dimmer to the Scene intensity', () => {
    const s = show(scene('half', [{ target: {}, intensity: 0.5 }]));

    const frames = resolveFrames(s, patch([fixture({})]), play(s, ['half', 0]), 0);

    expect(channels(frames, 2)).toEqual([128, 0]);
  });

  it('targets Fixtures by Zone and Role, later Rules overriding earlier ones', () => {
    const upstageLeft = { row: 'Upstage', column: 'Stage Left', level: 'Floor' } as const;
    const s = show(
      scene('look', [
        { target: {}, intensity: 0.2 },
        { target: { zones: [upstageLeft] }, intensity: 1 },
        // The Strobe is upstage, so this matches no Fixture.
        {
          target: { zones: [{ ...upstageLeft, row: 'Downstage' }], roles: ['Strobe'] },
          intensity: 0.6,
        },
        { target: { roles: ['Wash'] }, intensity: 0.4 },
      ]),
    );
    const rig = patch([
      fixture({ id: 'wash', address: 1 }),
      fixture({ id: 'strobe', address: 2, x: 4, y: 8, role: 'Strobe' }),
    ]);

    const frames = resolveFrames(s, rig, play(s, ['look', 0]), 0);

    expect(channels(frames, 2)).toEqual([102, 255]);
  });

  it('combines intensity across Layers highest first', () => {
    const s = show(
      scene('base', [{ target: {}, intensity: 0.6 }]),
      scene(
        'accent',
        [
          { target: {}, intensity: 0.3 },
          { target: { roles: ['Strobe'] }, intensity: 1 },
        ],
        {
          layer: 'l2',
        },
      ),
    );
    const rig = patch([
      fixture({ id: 'wash', address: 1 }),
      fixture({ id: 'strobe', address: 2, role: 'Strobe' }),
    ]);

    const frames = resolveFrames(s, rig, play(s, ['base', 0], ['accent', 1]), 1);

    expect(channels(frames, 2)).toEqual([153, 255]);
  });

  it('takes colour from the Layer changed most recently', () => {
    const s = show(
      scene('red', [{ target: {}, intensity: 1, colour: { swatch: 'Red' } }]),
      scene('green', [{ target: {}, intensity: 1, colour: { swatch: 'Green' } }]),
      scene('blue', [{ target: {}, colour: { swatch: 'Blue' } }], { layer: 'l2' }),
    );
    const rig = patch([fixture({ profileId: rgb.id })], [rgb]);
    const at = (...steps: [string, number][]) =>
      channels(resolveFrames(s, rig, play(s, ...steps), 5), 4);

    expect(at(['red', 0], ['blue', 1])).toEqual([255, 0, 0, 255]);
    expect(at(['red', 0], ['blue', 1], ['green', 2])).toEqual([255, 0, 255, 0]);
    // Changed at the same time: the later Layer wins.
    expect(at(['blue', 3], ['green', 3])).toEqual([255, 0, 0, 255]);
  });

  it('applies the Grand Master last, to intensity only', () => {
    const s = show(scene('look', [{ target: {}, intensity: 0.8, colour: { swatch: 'Red' } }]));
    const rig = patch(
      [fixture({ profileId: rgb.id }), fixture({ id: 'f2', profileId: rgbw.id, address: 5 })],
      [rgb, rgbw],
    );

    const frames = resolveFrames(s, rig, play(s, ['look', 0]), 0, 0.5);

    expect(channels(frames, 8)).toEqual([102, 255, 0, 0, 102, 0, 0, 0]);
  });

  it('resolves the same Show against two Venue Patches', () => {
    const s = show(
      scene('chorus', [
        { target: { roles: ['Wash'] }, intensity: 0.5, colour: { swatch: 'Amber' } },
        { target: { roles: ['Strobe'] }, intensity: 1 },
      ]),
    );
    const active = play(s, ['chorus', 0]);
    const club = patch(
      [
        fixture({ id: 'wash', profileId: rgbaw.id }),
        fixture({ id: 'strobe', address: 7, x: 4, y: 8, role: 'Strobe' }),
      ],
      [rgbaw, dimmer],
    );
    const festival: VenuePatch = {
      ...patch(
        [
          fixture({ id: 'spot', profileId: wheel.id, universe: 2, address: 10 }),
          fixture({ id: 'strobe', profileId: rgb.id, role: 'Strobe' }),
        ],
        [wheel, rgb],
      ),
      universes: [{ number: 1 }, { number: 2 }],
    };

    expect(channels(resolveFrames(s, club, active, 0), 7)).toEqual([128, 0, 0, 0, 255, 0, 255]);
    const frames = resolveFrames(s, festival, active, 0);
    // Amber is nearest to the Red slot; the Strobe has no colour set.
    expect([...frames.get(2)!.subarray(9, 11)]).toEqual([128, 14]);
    expect(channels(frames, 4)).toEqual([255, 0, 0, 0]);
  });

  it('leaves colour channels at their Profile defaults when no Rule sets colour', () => {
    const warm = (p: FixtureProfile): FixtureProfile => ({
      ...p,
      id: `${p.id}-warm`,
      modes: p.modes.map((m) => ({
        ...m,
        channels: m.channels.map((c) =>
          c.kind === 'control' && c.name !== 'Dimmer' ? { ...c, defaultValue: 200 } : c,
        ),
      })),
    });
    const s = show(scene('look', [{ target: {}, intensity: 0.5 }]));
    const rig = patch(
      [
        fixture({ profileId: warm(rgb).id }),
        // Without a dimmer, intensity scales the defaults.
        fixture({ id: 'f2', profileId: warm(rgbw).id, address: 5 }),
      ],
      [warm(rgb), warm(rgbw)],
    );

    expect(channels(resolveFrames(s, rig, play(s, ['look', 0]), 0), 8)).toEqual([
      128, 200, 200, 200, 100, 100, 100, 100,
    ]);
    expect(channels(resolveFrames(s, rig, {}, 0), 8)).toEqual([0, 200, 200, 200, 0, 0, 0, 0]);
  });

  it('encodes intensity across its DMX range, with a fine channel, and opens the shutter', () => {
    const moving = profile('test/moving', [
      {
        kind: 'control',
        name: 'Dimmer',
        defaultValue: 0,
        ranges: [
          { from: 0, to: 9, capability: { type: 'none' } },
          { from: 10, to: 255, capability: { type: 'intensity' } },
        ],
      },
      { kind: 'fine', name: 'Dimmer fine', of: 'Dimmer', byte: 1, defaultValue: 0 },
      {
        kind: 'control',
        name: 'Shutter',
        defaultValue: 0,
        ranges: [
          { from: 0, to: 31, capability: { type: 'shutter', effect: 'closed' } },
          { from: 32, to: 63, capability: { type: 'shutter', effect: 'open' } },
          { from: 64, to: 255, capability: { type: 'strobe' } },
        ],
      },
      { kind: 'unused' },
    ]);
    const inverted = profile('test/inverted', [
      channel('Dimmer', { type: 'intensity', level: [1, 0] }),
    ]);
    const s = show(scene('look', [{ target: {}, intensity: 0.25 }]));
    const rig = patch(
      [
        fixture({ profileId: moving.id }),
        fixture({ id: 'f2', profileId: inverted.id, address: 5 }),
      ],
      [moving, inverted],
    );

    // Dimmer 10–255 is 2560–65535 in 16 bits; a quarter of the way is
    // 18304 = 71 × 256 + 128. The inverted dimmer is three quarters up.
    expect(channels(resolveFrames(s, rig, play(s, ['look', 0]), 0), 5)).toEqual([
      71, 128, 47, 0, 191,
    ]);
  });

  describe('fades', () => {
    const s = show(
      scene('dim', [{ target: {}, intensity: 0.2, colour: { swatch: 'Red' } }]),
      scene('full', [{ target: {}, intensity: 1, colour: { swatch: 'Blue' } }], { fadeIn: 2 }),
      scene('out', [{ target: {}, intensity: 0 }], { fadeIn: 1 }),
    );
    const rig = patch([fixture({ profileId: rgb.id })], [rgb]);
    const at = (active: ActiveScenes, time: number) =>
      channels(resolveFrames(s, rig, active, time), 4);

    it('fades a Scene in from a clear Layer over its fade-in', () => {
      const active = play(s, ['full', 10]);

      expect(at(active, 10)).toEqual([0, 0, 0, 255]);
      expect(at(active, 11)).toEqual([128, 0, 0, 255]);
      expect(at(active, 12)).toEqual([255, 0, 0, 255]);
      expect(at(active, 20)).toEqual([255, 0, 0, 255]);
    });

    it('crossfades intensity and colour from the Scene it replaces', () => {
      const active = play(s, ['dim', 0], ['full', 10]);

      expect(at(active, 10)).toEqual([51, 255, 0, 0]);
      expect(at(active, 11)).toEqual([153, 128, 0, 128]);
      expect(at(active, 12)).toEqual([255, 0, 0, 255]);
    });

    it('crossfades from where an interrupted fade had got to', () => {
      // Half way into 'full' (0.6), then fading to 0 over 1 s.
      const active = play(s, ['dim', 0], ['full', 10], ['out', 11]);

      // 'out' sets no colour: the half-way colour holds until the fade ends.
      expect(at(active, 11.5)).toEqual([77, 128, 0, 128]);
      expect(at(active, 12)).toEqual([0, 0, 0, 0]);
    });

    it('clears a Layer at once, even mid-fade', () => {
      const active = clearLayer(play(s, ['dim', 0], ['full', 10]), 'l1');

      expect(at(active, 11)).toEqual([0, 0, 0, 0]);
    });
  });

  describe('colour', () => {
    // Resolves one Rule on one Fixture of `p` at address 1.
    function resolveOn(p: FixtureProfile, rule: Rule): number[] {
      const s = show(scene('look', [rule]));
      const rig = patch([fixture({ profileId: p.id })], [p]);
      const frames = resolveFrames(s, rig, play(s, ['look', 0]), 0);
      return channels(frames, p.modes[0]!.channels.length);
    }

    it('mixes hue and saturation on RGB', () => {
      expect(
        resolveOn(rgb, { target: {}, intensity: 1, colour: { hue: 30, saturation: 1 } }),
      ).toEqual([255, 255, 128, 0]);
      expect(
        resolveOn(rgb, { target: {}, intensity: 0.2, colour: { hue: 240, saturation: 0.5 } }),
      ).toEqual([51, 128, 128, 255]);
    });

    it('takes white from the white emitter on RGBW', () => {
      const pink = { hue: 0, saturation: 0.5 };
      expect(resolveOn(rgbw, { target: {}, intensity: 1, colour: pink })).toEqual([128, 0, 0, 128]);
      expect(
        resolveOn(rgbw, { target: {}, intensity: 0.4, colour: { hue: 0, saturation: 0 } }),
      ).toEqual([0, 0, 0, 102]);
    });

    it('takes amber and white from their emitters on RGBAW', () => {
      // Red 1, green 0.5: two thirds amber (1, 0.75, 0), a third red.
      expect(
        resolveOn(rgbaw, { target: {}, intensity: 1, colour: { hue: 30, saturation: 1 } }),
      ).toEqual([255, 85, 0, 0, 170, 0]);
      expect(
        resolveOn(rgbaw, { target: {}, intensity: 1, colour: { hue: 240, saturation: 0.5 } }),
      ).toEqual([255, 0, 0, 128, 0, 128]);
    });

    it('picks the nearest colour-wheel slot', () => {
      const look = (hue: number, saturation: number): Rule => ({
        target: {},
        intensity: 1,
        colour: { hue, saturation },
      });
      expect(resolveOn(wheel, look(350, 0.9))).toEqual([255, 14]);
      expect(resolveOn(wheel, look(200, 0.9))).toEqual([255, 24]);
      expect(resolveOn(wheel, look(0, 0.1))).toEqual([255, 4]);
    });

    it('sets white-only emitters by intensity, ignoring colour', () => {
      const blinder = profile('test/blinder', [
        emitter('Warm', 'warmWhite'),
        emitter('Cold', 'coldWhite'),
      ]);
      expect(resolveOn(blinder, { target: {}, intensity: 0.5, colour: { swatch: 'Red' } })).toEqual(
        [128, 128],
      );
    });

    it('sets only intensity on a Fixture without colour', () => {
      expect(
        resolveOn(dimmer, { target: {}, intensity: 0.5, colour: { hue: 120, saturation: 1 } }),
      ).toEqual([128]);
    });

    it('translates swatches', () => {
      const swatch = (name: Swatch): Rule => ({
        target: {},
        intensity: 1,
        colour: { swatch: name },
      });
      expect(resolveOn(rgb, swatch('Red'))).toEqual([255, 255, 0, 0]);
      expect(resolveOn(rgbaw, swatch('Amber'))).toEqual([255, 0, 0, 0, 255, 0]);
      expect(resolveOn(rgbaw, swatch('White'))).toEqual([255, 0, 0, 0, 0, 255]);
      expect(resolveOn(wheel, swatch('Blue'))).toEqual([255, 24]);
    });

    it('uses the UV emitter for UV, or deep violet without one', () => {
      const uv: Rule = { target: {}, intensity: 1, colour: { swatch: 'UV' } };
      expect(resolveOn(rgbUv, uv)).toEqual([0, 0, 0, 255]);
      expect(resolveOn(rgb, uv)).toEqual([255, 77, 0, 255]);
    });
  });
});
