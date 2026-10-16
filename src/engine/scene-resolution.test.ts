import { describe, expect, it } from 'vitest';
import type {
  Capability,
  CapabilityRange,
  Channel,
  Emitter,
  FixtureProfile,
} from '../shared/fixture-profile';
import type {
  IntensityEffect,
  MovementEffect,
  Rule,
  Scene,
  Show,
  Spread,
  Swatch,
} from '../shared/show';
import type { PatchedFixture, VenuePatch } from '../shared/venue-patch';
import {
  activate,
  clearLayer,
  resolveFrames,
  resolveLights,
  type ActiveScenes,
} from './scene-resolution';

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

// Activates the Scenes in order, each at its given time, on a rig.
function playOn(rig: VenuePatch, s: Show, ...steps: [string, number][]): ActiveScenes {
  return steps.reduce<ActiveScenes>((active, [id, time]) => activate(active, s, rig, id, time), {});
}

// As `playOn`, for a Show whose tests have no movers: no aims to keep.
function play(s: Show, ...steps: [string, number][]): ActiveScenes {
  return playOn(patch([]), s, ...steps);
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
    // Amber is nearest to the Red slot; the Strobe has no colour set, so it
    // is White.
    expect([...frames.get(2)!.subarray(9, 11)]).toEqual([128, 14]);
    expect(channels(frames, 4)).toEqual([255, 255, 255, 255]);
  });

  it("uses the Show's default colour when no Rule sets colour, or White without one", () => {
    const s = show(scene('look', [{ target: {}, intensity: 0.5 }]));
    const rig = patch(
      [
        fixture({ profileId: rgb.id }),
        // Without a dimmer, intensity scales the emitters.
        fixture({ id: 'f2', profileId: rgbw.id, address: 5 }),
        fixture({ id: 'f3', profileId: wheel.id, address: 9 }),
      ],
      [rgb, rgbw, wheel],
    );
    const active = play(s, ['look', 0]);

    expect(channels(resolveFrames(s, rig, active, 0), 10)).toEqual([
      128, 255, 255, 255, 0, 0, 0, 128, 128, 4,
    ]);
    const red: Show = { ...s, defaultColour: { swatch: 'Red' } };
    expect(channels(resolveFrames(red, rig, active, 0), 10)).toEqual([
      128, 255, 0, 0, 128, 0, 0, 0, 128, 14,
    ]);
    expect(resolveLights(red, rig, active, 0).f1).toEqual({
      intensity: 0.5,
      red: 1,
      green: 0,
      blue: 0,
    });
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
      // Then no Scene sets colour: the default, White, at intensity 0.
      expect(at(active, 12)).toEqual([0, 255, 255, 255]);
    });

    it('clears a Layer at once, even mid-fade', () => {
      const active = clearLayer(play(s, ['dim', 0], ['full', 10]), 'l1');

      expect(at(active, 11)).toEqual([0, 255, 255, 255]);
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

  describe('Directions', () => {
    const mover = profile('test/mover', [
      channel('Dimmer', { type: 'intensity' }),
      channel('Pan', { type: 'pan', degrees: [-270, 270] }),
      channel('Tilt', { type: 'tilt', degrees: [-135, 135] }),
    ]);
    // Hung 6 m up on Stage Left. Down is pan and tilt at their centres;
    // Cross aims at the mirror point, pan 90° and tilt 45°: 2/3 across both.
    const hung = fixture({ id: 'mover', profileId: mover.id, x: 3, y: 4, height: 6 });
    const DOWN = [128, 128];
    const CROSS = [170, 170];
    const rig = patch([hung, fixture({ id: 'par', address: 4 })], [mover, dimmer]);

    // Pan and tilt of the mover, then the dimmer-only Fixture.
    const aimed = (s: Show, active: ActiveScenes, time = 0) =>
      channels(resolveFrames(s, rig, active, time), 4).slice(1);

    it('aims movers at the Default Direction, Down unless changed', () => {
      const s = show(scene('lit', [{ target: {}, intensity: 1 }]));

      expect(aimed(s, {})).toEqual([...DOWN, 0]);
      expect(aimed({ ...s, defaultDirection: 'Cross' }, playOn(rig, s, ['lit', 0]))).toEqual([
        ...CROSS,
        255,
      ]);
    });

    it('takes the Direction of the Scene changed last that targets the mover', () => {
      const s = show(
        scene('cross', [{ target: {}, direction: 'Cross' }]),
        scene('down', [{ target: {}, direction: 'Down' }], { layer: 'l2' }),
        scene('dim', [{ target: {}, intensity: 0.5 }], { layer: 'l2' }),
      );

      expect(aimed(s, playOn(rig, s, ['cross', 0]))).toEqual([...CROSS, 0]);
      // Down keeps the pan shown, as pan does not change it.
      expect(aimed(s, playOn(rig, s, ['cross', 0], ['down', 1]))).toEqual([170, 128, 0]);
      expect(aimed(s, playOn(rig, s, ['down', 0], ['cross', 1]))).toEqual([...CROSS, 0]);
      // A Scene that sets no Direction leaves it to the others.
      expect(aimed(s, playOn(rig, s, ['cross', 0], ['dim', 1]))).toEqual([...CROSS, 128]);
    });

    it("gives the preview each mover's pan and tilt, as sent", () => {
      const s = show(
        scene('cross', [{ target: {}, intensity: 1, direction: 'Cross' }]),
        scene('down', [{ target: {}, intensity: 1, direction: 'Down' }], { fadeIn: 2 }),
      );
      const active = playOn(rig, s, ['cross', 0], ['down', 10]);
      const aimOf = (time: number) => resolveLights(s, rig, active, time).mover?.aim;

      expect(aimOf(10)).toEqual({ pan: expect.closeTo(90), tilt: expect.closeTo(45) });
      // Half way to Down, pan kept.
      expect(aimOf(11)).toEqual({ pan: expect.closeTo(90), tilt: expect.closeTo(22.5) });
      expect(resolveLights(s, rig, active, 11).par).not.toHaveProperty('aim');
    });

    it('lets later Rules override earlier ones, and only aims Fixtures they target', () => {
      const s = show(
        scene('look', [
          { target: {}, direction: 'Up' },
          { target: { roles: ['Wash'] }, direction: 'Cross' },
          { target: { roles: ['Strobe'] }, direction: 'Down' },
        ]),
      );

      expect(aimed(s, playOn(rig, s, ['look', 0]))).toEqual([...CROSS, 0]);
    });

    describe('moves', () => {
      const s = show(
        scene('cross', [{ target: {}, intensity: 1, direction: 'Cross' }]),
        scene('dark cross', [{ target: {}, direction: 'Cross' }]),
        scene('out', [{ target: {}, intensity: 1, direction: 'Out' }], { fadeIn: 2 }),
        scene('down', [{ target: {}, intensity: 1, direction: 'Down' }], { layer: 'l2' }),
      );
      // Out is pan -18°, tilt 77°; or pan 162°, tilt -77°, nearer the 90° of
      // Cross. Then 204 and 55, against 119 and 200 from the centre.
      const OUT = [204, 55];
      // Pan and tilt of the mover alone.
      const panTilt = (s: Show, active: ActiveScenes, time = 0) =>
        aimed(s, active, time).slice(0, 2);

      it('fades pan and tilt in degrees from the aim shown, to the pan nearest it', () => {
        const active = playOn(rig, s, ['cross', 0], ['out', 10]);

        expect(panTilt(s, active, 10)).toEqual(CROSS);
        // Half way: pan 126°, tilt -16°.
        expect(panTilt(s, active, 11)).toEqual([187, 112]);
        expect(panTilt(s, active, 12)).toEqual(OUT);
        expect(panTilt(s, active, 20)).toEqual(OUT);
      });

      it('starts from the range centre, where the Default Direction leaves pan', () => {
        expect(panTilt(s, playOn(rig, s, ['out', 0]), 2)).toEqual([119, 200]);
      });

      it('snaps a mover dark at activation to its new aim', () => {
        const dark = playOn(rig, s, ['dark cross', 0], ['out', 10]);
        expect(panTilt(s, dark, 10)).toEqual(OUT);

        // Dark at the Grand Master too.
        const lit = playOn(rig, s, ['cross', 0]);
        const blackout = activate(lit, s, rig, 'out', 10, 0);
        expect(panTilt(s, blackout, 11)).toEqual(OUT);
      });

      it('moves to the Direction left when a Layer crossfades into a Scene without one', () => {
        const lit = scene('lit', [{ target: {}, intensity: 1 }], { fadeIn: 2 });
        const t = show(...s.scenes, lit);
        const active = playOn(rig, t, ['down', 0], ['cross', 5], ['lit', 10]);

        expect(panTilt(t, active, 10)).toEqual(CROSS);
        // Half way to Down: pan kept at 90°, tilt 22.5°.
        expect(panTilt(t, active, 11)).toEqual([170, 149]);
        expect(panTilt(t, active, 12)).toEqual([170, 128]);
      });

      it('keeps the pan shown at the Default Direction', () => {
        const lit = scene('lit', [{ target: {}, intensity: 1 }]);
        const t = show(...s.scenes, lit);

        // Down after Cross, without a swing back to the centre.
        expect(panTilt(t, playOn(rig, t, ['cross', 0], ['lit', 10]), 10)).toEqual([170, 128]);
      });

      it("drops a cleared Layer's aims at once, back to the next Layer's", () => {
        const active = playOn(rig, s, ['down', 0], ['cross', 5], ['out', 10]);

        expect(panTilt(s, clearLayer(active, 'l1'), 11)).toEqual(DOWN);
      });
    });
  });
});

describe('resolveLights', () => {
  // How one Rule makes a Fixture of `p` look.
  function lightOn(p: FixtureProfile, rule: Rule) {
    const s = show(scene('look', [rule]));
    const rig = patch([fixture({ profileId: p.id })], [p]);
    return resolveLights(s, rig, play(s, ['look', 0]), 0).f1;
  }

  const white = { red: 1, green: 1, blue: 1 };

  it('gives each Fixture its intensity and the colour it shows, by Fixture id', () => {
    const s = show(
      scene('look', [
        { target: {}, intensity: 0.5 },
        { target: { roles: ['Blinder'] }, intensity: 1 },
      ]),
    );
    const rig = patch([fixture({ id: 'a' }), fixture({ id: 'b', address: 2, role: 'Blinder' })]);

    expect(resolveLights(s, rig, play(s, ['look', 0]), 0)).toEqual({
      a: { intensity: 0.5, ...white },
      b: { intensity: 1, ...white },
    });
  });

  it('shows a Fixture that no Scene lights at intensity 0', () => {
    const rig = patch([fixture({})]);
    expect(resolveLights(show(), rig, {}, 0)).toEqual({ f1: { intensity: 0, ...white } });
  });

  it('shows the colour an RGB Fixture mixes, White by default', () => {
    expect(
      lightOn(rgb, { target: {}, intensity: 0.2, colour: { hue: 240, saturation: 0.5 } }),
    ).toEqual({ intensity: 0.2, red: 0.5, green: 0.5, blue: 1 });
    expect(lightOn(rgb, { target: {}, intensity: 1 })).toEqual({ intensity: 1, ...white });
  });

  it('shows deep violet for UV', () => {
    expect(lightOn(rgbUv, { target: {}, intensity: 1, colour: { swatch: 'UV' } })).toEqual({
      intensity: 1,
      red: 0.3,
      green: 0,
      blue: 1,
    });
  });

  it('shows the colour of the colour-wheel slot picked', () => {
    const red = { target: {}, intensity: 1, colour: { hue: 350, saturation: 0.9 } };
    expect(lightOn(wheel, red)).toEqual({ intensity: 1, red: 1, green: 0, blue: 0 });
  });

  it('shows the colour of fixed emitters, ignoring the Rule colour', () => {
    const blinder = profile('test/blinder', [
      emitter('Warm', 'warmWhite'),
      emitter('Cold', 'coldWhite'),
    ]);
    const light = lightOn(blinder, { target: {}, intensity: 0.5, colour: { swatch: 'Red' } });
    expect(light).toEqual({
      intensity: 0.5,
      red: expect.closeTo(0.925),
      green: expect.closeTo(0.875),
      blue: expect.closeTo(0.8),
    });
  });

  it('fades intensity and colour, and applies the Grand Master', () => {
    const s = show(
      scene('red', [{ target: {}, intensity: 1, colour: { swatch: 'Red' } }]),
      scene('blue', [{ target: {}, intensity: 0.5, colour: { swatch: 'Blue' } }], { fadeIn: 2 }),
    );
    const rig = patch([fixture({ profileId: rgb.id })], [rgb]);
    const active = play(s, ['red', 0], ['blue', 10]);

    expect(resolveLights(s, rig, active, 11, 0.5).f1).toEqual({
      intensity: 0.375,
      red: 0.5,
      green: 0,
      blue: 0.5,
    });
  });
});

describe('movement Effects', () => {
  const mover = profile('test/mover', [
    channel('Dimmer', { type: 'intensity' }),
    channel('Pan', { type: 'pan', degrees: [-270, 270] }),
    channel('Tilt', { type: 'tilt', degrees: [-135, 135] }),
  ]);
  // Hung 6 m up on Stage Left. Cross is pan 90°, tilt 45°.
  const hung = fixture({ id: 'mover', profileId: mover.id, x: 3, y: 4, height: 6 });
  const rig = patch([hung], [mover]);
  const effect = (overrides: Partial<MovementEffect> = {}): MovementEffect => ({
    shape: 'Pan sweep',
    size: 10,
    length: 4,
    spread: 'In sync',
    ...overrides,
  });

  // A mover's pan and tilt, in degrees, at `beat` of the Tempo.
  function aimAtBeat(s: Show, active: ActiveScenes, beat: number, time = 0, r = rig, id = 'mover') {
    const aim = resolveLights(s, r, active, time, 1, beat)[id]?.aim;
    return [Math.round(aim?.pan ?? NaN), Math.round(aim?.tilt ?? NaN)];
  }

  it('sweeps pan around the base aim over its length in beats', () => {
    const s = show(scene('sweep', [{ target: {}, direction: 'Cross', movementEffect: effect() }]));
    const active = playOn(rig, s, ['sweep', 0]);

    expect([0, 1, 2, 3, 4].map((beat) => aimAtBeat(s, active, beat))).toEqual([
      [90, 45],
      [100, 45],
      [90, 45],
      [80, 45],
      [90, 45],
    ]);
  });
  it('sweeps tilt, and circles with tilt a quarter cycle ahead of pan', () => {
    const s = show(
      scene('tilt', [
        { target: {}, direction: 'Cross', movementEffect: effect({ shape: 'Tilt sweep' }) },
      ]),
      scene('circle', [
        { target: {}, direction: 'Cross', movementEffect: effect({ shape: 'Circle' }) },
      ]),
    );
    const at = (id: string) => [0, 1, 2, 3].map((b) => aimAtBeat(s, playOn(rig, s, [id, 0]), b));

    expect(at('tilt')).toEqual([
      [90, 45],
      [90, 55],
      [90, 45],
      [90, 35],
    ]);
    expect(at('circle')).toEqual([
      [90, 55],
      [100, 45],
      [90, 35],
      [80, 45],
    ]);
  });

  it('wanders smoothly with Ballyhoo, within its size, the same each time for a Fixture', () => {
    const ballyhoo = effect({ shape: 'Ballyhoo', size: 20, length: 8 });
    const s = show(scene('wander', [{ target: {}, direction: 'Cross', movementEffect: ballyhoo }]));
    const twin = fixture({ id: 'twin', profileId: mover.id, x: 3, y: 4, height: 6, address: 4 });
    const both = patch([hung, twin], [mover]);
    const active = playOn(both, s, ['wander', 0]);
    const angles = (beat: number, id: string) => {
      const aim = resolveLights(s, both, active, 0, 1, beat)[id]!.aim!;
      return [aim.pan! - 90, aim.tilt! - 45];
    };
    const beats = Array.from({ length: 64 }, (_, i) => i / 8);

    for (const beat of beats) {
      const [pan, tilt] = angles(beat, 'mover');
      expect(Math.abs(pan!)).toBeLessThanOrEqual(20);
      expect(Math.abs(tilt!)).toBeLessThanOrEqual(20);
      // Smooth: an eighth of a beat moves it little.
      const [nextPan, nextTilt] = angles(beat + 1 / 8, 'mover');
      expect(Math.abs(nextPan! - pan!)).toBeLessThan(5);
      expect(Math.abs(nextTilt! - tilt!)).toBeLessThan(5);
    }
    expect(angles(3, 'mover')).toEqual(angles(3, 'mover'));
    // It repeats each cycle.
    const [pan, tilt] = angles(3, 'mover');
    expect(angles(11, 'mover')).toEqual([expect.closeTo(pan!), expect.closeTo(tilt!)]);
    expect(angles(3, 'twin')).not.toEqual(angles(3, 'mover'));
    // It wanders.
    expect(new Set(beats.map((b) => Math.round(angles(b, 'mover')[0]!))).size).toBeGreaterThan(10);
  });

  it('clamps the turned aim to the Fixture range', () => {
    // Down is tilt 0 of ±135°; Up is out of reach, at the end of the range.
    const s = show(
      scene('up', [
        { target: {}, direction: 'Up', movementEffect: effect({ shape: 'Tilt sweep' }) },
      ]),
    );
    const active = playOn(rig, s, ['up', 0]);
    const tilts = [1, 3].map((beat) => Math.abs(aimAtBeat(s, active, beat)[1]!));

    // Turned 10° back into the range one way, held at its end the other.
    expect(tilts.sort()).toEqual([125, 135]);
  });

  it('turns an inverted axis the other way, so mirrored rigging moves together', () => {
    const inverted = fixture({
      ...hung,
      id: 'inverted',
      address: 4,
      mounting: {
        mount: 'Hung',
        rotation: 0,
        panInvert: true,
        tiltInvert: false,
        panOffset: 0,
        tiltOffset: 0,
      },
    });
    const both = patch([hung, inverted], [mover]);
    const s = show(scene('sweep', [{ target: {}, direction: 'Down', movementEffect: effect() }]));
    const active = playOn(both, s, ['sweep', 0]);

    expect(aimAtBeat(s, active, 1, 0, both, 'mover')[0]).toBe(10);
    expect(aimAtBeat(s, active, 1, 0, both, 'inverted')[0]).toBe(-10);
  });

  describe('Spread', () => {
    // Movers across the stage, at x -4, -2, 2 and 4, a beat apart.
    const at = (x: number, address: number) =>
      fixture({ id: `x${x}`, profileId: mover.id, x, y: 4, height: 6, address });
    const line = patch([at(4, 1), at(-2, 4), at(-4, 7), at(2, 10)], [mover]);
    // Each mover's pan offset at beat 1, as the fraction of the size it is
    // at: the sine of its phase.
    function phases(spread: Spread): Record<string, number> {
      const s = show(
        scene('sweep', [
          { target: {}, direction: 'Down', movementEffect: effect({ size: 20, spread }) },
        ]),
      );
      const lights = resolveLights(s, line, playOn(line, s, ['sweep', 0]), 0, 1, 1);
      return Object.fromEntries(
        Object.entries(lights).map(([id, light]) => [id, Math.round(light.aim!.pan! / 20)]),
      );
    }

    it('runs every Fixture together In sync', () => {
      expect(phases('In sync')).toEqual({ 'x-4': 1, 'x-2': 1, x2: 1, x4: 1 });
    });

    it('runs from the lowest x up, Left→Right', () => {
      // A quarter of the cycle apart: at beat 1, phases 1/4, 0, -1/4, -1/2.
      expect(phases('Left→Right')).toEqual({ 'x-4': 1, 'x-2': 0, x2: -1, x4: -0 });
    });

    it('runs from the centre out, Mirrored', () => {
      // Half the cycle apart: phases 1/4 and -1/4.
      expect(phases('Mirrored')).toEqual({ 'x-4': -1, 'x-2': 1, x2: 1, x4: -1 });
    });

    it('runs every other Fixture across half a cycle apart, Alternate', () => {
      expect(phases('Alternate')).toEqual({ 'x-4': 1, 'x-2': -1, x2: 1, x4: -1 });
    });

    it('spreads across the Fixtures the Rule targets only', () => {
      // Stage Left only: x 2 and 4.
      const s = show(
        scene('sweep', [
          {
            target: { zones: [{ row: 'Midstage', column: 'Stage Left', level: 'Overhead' }] },
            movementEffect: effect({ size: 20, spread: 'Left→Right' }),
          },
        ]),
      );
      const lights = resolveLights(s, line, playOn(line, s, ['sweep', 0]), 0, 1, 1);

      expect(Math.round(lights.x2!.aim!.pan! / 20)).toBe(1);
      expect(Math.round(lights.x4!.aim!.pan! / 20)).toBe(-1);
    });
  });

  it('runs around a Direction from another Layer, each combined by last change', () => {
    const s = show(
      scene('cross', [{ target: {}, direction: 'Cross' }]),
      scene('sweep', [{ target: {}, movementEffect: effect() }], { layer: 'l2' }),
      scene('tilt', [
        { target: {}, direction: 'Cross', movementEffect: effect({ shape: 'Tilt sweep' }) },
      ]),
    );

    // The Effect runs around Cross, set on the other Layer.
    expect(aimAtBeat(s, playOn(rig, s, ['cross', 0], ['sweep', 1]), 1)).toEqual([100, 45]);
    expect(aimAtBeat(s, playOn(rig, s, ['sweep', 0], ['cross', 1]), 1)).toEqual([100, 45]);
    // Without a Direction, around the Default Direction.
    expect(aimAtBeat({ ...s, defaultDirection: 'Cross' }, playOn(rig, s, ['sweep', 0]), 1)).toEqual(
      [100, 45],
    );
    // The Effect changed last wins.
    const active = playOn(rig, s, ['cross', 0], ['sweep', 1], ['tilt', 2]);
    expect(aimAtBeat(s, active, 1)).toEqual([90, 55]);
  });

  it("fades an Effect's size in with its Scene, and out with the one it replaces", () => {
    const s = show(
      scene('cross', [{ target: {}, direction: 'Cross' }]),
      scene('sweep', [{ target: {}, direction: 'Cross', movementEffect: effect() }], { fadeIn: 2 }),
    );
    const fadingIn = playOn(rig, s, ['cross', 0], ['sweep', 10]);
    const fadingOut = playOn(rig, s, ['sweep', 0], ['cross', 10]);

    expect([10, 11, 12].map((time) => aimAtBeat(s, fadingIn, 1, time)[0])).toEqual([90, 95, 100]);
    // Cross has no fade-in: the Effect stops at once.
    expect(aimAtBeat(s, fadingOut, 1, 10)[0]).toBe(90);
    const slow = { ...s, scenes: [{ ...s.scenes[0]!, fadeIn: 2 }, s.scenes[1]!] };
    const slowOut = playOn(rig, slow, ['sweep', 0], ['cross', 10]);
    expect([10, 11, 12].map((time) => aimAtBeat(slow, slowOut, 1, time)[0])).toEqual([100, 95, 90]);
  });

  it('moves between Directions from the aim shown, turning it once', () => {
    const s = show(
      scene('sweep', [{ target: {}, movementEffect: effect() }], { layer: 'l2' }),
      scene('down', [{ target: {}, intensity: 1, direction: 'Down' }]),
      scene('cross', [{ target: {}, intensity: 1, direction: 'Cross' }], { fadeIn: 2 }),
    );
    // At beat 1 the sweep turns pan 10°. Down keeps the pan of the range centre.
    const active = playOn(rig, s, ['sweep', 0], ['down', 1]);
    const moving = activate(active, s, rig, 'cross', 10, 1, 1);

    expect(aimAtBeat(s, active, 1, 10)).toEqual([10, 0]);
    expect(aimAtBeat(s, moving, 1, 10)).toEqual([10, 0]);
    expect(aimAtBeat(s, moving, 1, 12)).toEqual([100, 45]);
  });

  it('fades an Effect in from the one it takes over from on another Layer', () => {
    const s = show(
      scene('sweep', [{ target: {}, direction: 'Cross', movementEffect: effect() }]),
      scene('tilt', [{ target: {}, movementEffect: effect({ shape: 'Tilt sweep' }) }], {
        layer: 'l2',
        fadeIn: 2,
      }),
      scene('lit', [{ target: {}, intensity: 1 }], { layer: 'l2', fadeIn: 2 }),
    );
    const active = playOn(rig, s, ['sweep', 0], ['tilt', 10]);

    expect([10, 11, 12].map((time) => aimAtBeat(s, active, 1, time))).toEqual([
      [100, 45],
      [95, 50],
      [90, 55],
    ]);
    // A Scene without an Effect fades back to the one underneath.
    const back = activate(active, s, rig, 'lit', 20, 1, 1);
    expect([20, 21, 22].map((time) => aimAtBeat(s, back, 1, time))).toEqual([
      [90, 55],
      [95, 50],
      [100, 45],
    ]);
  });

  it('runs cycles of 1/2 and 1/4 beat', () => {
    const s = show(
      scene('half', [{ target: {}, direction: 'Cross', movementEffect: effect({ length: 0.5 }) }]),
      scene('quarter', [
        { target: {}, direction: 'Cross', movementEffect: effect({ length: 0.25 }) },
      ]),
    );
    const pans = (id: string, step: number) =>
      [0, 1, 2, 3, 4].map((i) => aimAtBeat(s, playOn(rig, s, [id, 0]), i * step)[0]);

    expect(pans('half', 1 / 8)).toEqual([90, 100, 90, 80, 90]);
    expect(pans('quarter', 1 / 16)).toEqual([90, 100, 90, 80, 90]);
  });

  describe('None', () => {
    const s = show(
      scene('sweep', [{ target: {}, direction: 'Cross', movementEffect: effect() }]),
      scene('still', [{ target: {}, movementEffect: 'None' }], { layer: 'l2' }),
      scene('slow still', [{ target: {}, movementEffect: 'None' }], { layer: 'l2', fadeIn: 2 }),
      scene('lit', [{ target: {}, intensity: 1 }], { layer: 'l2' }),
    );

    it("stops a lower Layer's movement Effect, leaving its Direction", () => {
      expect(aimAtBeat(s, playOn(rig, s, ['sweep', 0], ['still', 1]), 1)).toEqual([90, 45]);
      // A Scene that leaves the slot alone keeps it running.
      expect(aimAtBeat(s, playOn(rig, s, ['sweep', 0], ['lit', 1]), 1)).toEqual([100, 45]);
      // Changed last, the Effect wins.
      expect(aimAtBeat(s, playOn(rig, s, ['still', 0], ['sweep', 1]), 1)).toEqual([100, 45]);
    });

    it("stops an earlier Rule's movement Effect in its Scene", () => {
      const own = show(
        scene('sweep', [
          { target: {}, direction: 'Cross', movementEffect: effect() },
          { target: {}, movementEffect: 'None' },
        ]),
      );

      expect(aimAtBeat(own, playOn(rig, own, ['sweep', 0]), 1)).toEqual([90, 45]);
    });

    it("stills the turn over its Scene's fade-in", () => {
      const active = playOn(rig, s, ['sweep', 0], ['slow still', 10]);

      expect([10, 11, 12].map((time) => aimAtBeat(s, active, 1, time)[0])).toEqual([100, 95, 90]);
    });
  });

  it('leaves Fixtures without pan or tilt alone', () => {
    const par = fixture({ id: 'par', address: 4 });
    const r = patch([hung, par], [mover, dimmer]);
    const s = show(scene('sweep', [{ target: {}, intensity: 1, movementEffect: effect() }]));

    expect(channels(resolveFrames(s, r, playOn(r, s, ['sweep', 0]), 0, 1, 1), 4)[3]).toBe(255);
    expect(resolveLights(s, r, playOn(r, s, ['sweep', 0]), 0, 1, 1).par).not.toHaveProperty('aim');
  });
});

describe('intensity Effects', () => {
  const effect = (overrides: Partial<IntensityEffect> = {}): IntensityEffect => ({
    shape: 'Square',
    depth: 1,
    length: 4,
    spread: 'In sync',
    ...overrides,
  });
  const rig = patch([fixture({})]);

  // The Fixture's intensity at `beat` of the Tempo and `time`.
  function intensityAt(s: Show, active: ActiveScenes, beat: number, time = 0, grandMaster = 1) {
    return resolveLights(s, rig, active, time, grandMaster, beat).f1!.intensity;
  }

  it('scales the intensity over its cycle', () => {
    const s = show(scene('pulse', [{ target: {}, intensity: 0.8, intensityEffect: effect() }]));
    const active = play(s, ['pulse', 0]);

    expect([0, 1, 2, 3, 4].map((beat) => intensityAt(s, active, beat))).toEqual([
      0.8, 0.8, 0, 0, 0.8,
    ]);
    // Sent on the dimmer.
    expect(channels(resolveFrames(s, rig, active, 0, 1, 2), 1)).toEqual([0]);
  });

  it('dips by its depth', () => {
    const s = show(
      scene('half', [{ target: {}, intensity: 0.8, intensityEffect: effect({ depth: 0.5 }) }]),
      scene('none', [{ target: {}, intensity: 0.8, intensityEffect: effect({ depth: 0 }) }]),
    );

    expect(intensityAt(s, play(s, ['half', 0]), 2)).toBeCloseTo(0.4);
    expect(intensityAt(s, play(s, ['none', 0]), 2)).toBeCloseTo(0.8);
  });

  it("scales a lower Layer's intensity, each combined by last change", () => {
    const s = show(
      scene('lit', [{ target: {}, intensity: 0.8 }]),
      scene('pulse', [{ target: {}, intensityEffect: effect() }], { layer: 'l2' }),
      scene('bright', [{ target: {}, intensity: 1 }]),
    );

    expect(intensityAt(s, play(s, ['lit', 0], ['pulse', 1]), 2)).toBe(0);
    expect(intensityAt(s, play(s, ['pulse', 0], ['lit', 1]), 2)).toBe(0);
    expect(intensityAt(s, play(s, ['lit', 0], ['pulse', 1]), 1)).toBeCloseTo(0.8);
    // A Scene changed later that leaves the slot alone keeps it running, over
    // its intensity too.
    expect(intensityAt(s, play(s, ['lit', 0], ['pulse', 1], ['bright', 2]), 2)).toBe(0);
  });

  it("fades its depth in with its Scene's fade-in", () => {
    const s = show(
      scene('lit', [{ target: {}, intensity: 0.8 }]),
      scene('pulse', [{ target: {}, intensityEffect: effect() }], { layer: 'l2', fadeIn: 2 }),
    );
    const active = play(s, ['lit', 0], ['pulse', 10]);

    expect([10, 11, 12].map((time) => intensityAt(s, active, 2, time))).toEqual([0.8, 0.4, 0]);
  });

  describe('None', () => {
    const s = show(
      scene('lit', [{ target: {}, intensity: 0.8, intensityEffect: effect() }]),
      scene('steady', [{ target: {}, intensityEffect: 'None' }], { layer: 'l2' }),
      scene('slow steady', [{ target: {}, intensityEffect: 'None' }], { layer: 'l2', fadeIn: 2 }),
    );

    it("stops a lower Layer's intensity Effect", () => {
      expect(intensityAt(s, play(s, ['lit', 0], ['steady', 1]), 2)).toBeCloseTo(0.8);
      // Changed last, the Effect wins.
      expect(intensityAt(s, play(s, ['steady', 0], ['lit', 1]), 2)).toBe(0);
    });

    it("stops an earlier Rule's intensity Effect in its Scene", () => {
      const own = show(
        scene('lit', [
          { target: {}, intensity: 0.8, intensityEffect: effect() },
          { target: {}, intensityEffect: 'None' },
        ]),
      );

      expect(intensityAt(own, play(own, ['lit', 0]), 2)).toBeCloseTo(0.8);
    });

    it("steadies the intensity over its Scene's fade-in", () => {
      const active = play(s, ['lit', 0], ['slow steady', 10]);

      expect([10, 11, 12].map((time) => intensityAt(s, active, 2, time))).toEqual([0, 0.4, 0.8]);
    });
  });

  describe('Chase', () => {
    // Dimmers across the stage, at x -4, -2, 2 and 4.
    const at = (x: number, address: number) => fixture({ id: `x${x}`, x, address });
    const line = patch([at(4, 1), at(-2, 2), at(-4, 3), at(2, 4)]);
    // The Fixtures lit at each beat, by x.
    function litAt(spread: Spread, beats: number[]): string[][] {
      const s = show(
        scene('chase', [
          { target: {}, intensity: 1, intensityEffect: effect({ shape: 'Chase', spread }) },
        ]),
      );
      const active = play(s, ['chase', 0]);
      return beats.map((beat) => {
        const lights = resolveLights(s, line, active, 0, 1, beat);
        return ['x-4', 'x-2', 'x2', 'x4'].filter((id) => lights[id]!.intensity > 0);
      });
    }

    it('lights one of 4 positions at a time, Left→Right', () => {
      expect(litAt('Left→Right', [0.5, 1.5, 2.5, 3.5])).toEqual([['x-4'], ['x-2'], ['x2'], ['x4']]);
    });

    it('lights the centre pair, then the outer pair, Mirrored', () => {
      expect(litAt('Mirrored', [1, 3])).toEqual([
        ['x-2', 'x2'],
        ['x-4', 'x4'],
      ]);
    });

    it('is a Square In sync', () => {
      expect(litAt('In sync', [1, 3])).toEqual([['x-4', 'x-2', 'x2', 'x4'], []]);
    });
  });

  it('applies the Grand Master and Blackout after it', () => {
    const s = show(
      scene('pulse', [{ target: {}, intensity: 0.8, intensityEffect: effect({ depth: 0.5 }) }]),
    );
    const active = play(s, ['pulse', 0]);

    expect(intensityAt(s, active, 2, 0, 0.5)).toBeCloseTo(0.2);
    expect(intensityAt(s, active, 0, 0, 0)).toBe(0);
  });

  it('scales the emitters of a Fixture without a dimmer', () => {
    const s = show(
      scene('pulse', [
        {
          target: {},
          intensity: 1,
          colour: { swatch: 'Red' },
          intensityEffect: effect({ depth: 0.5 }),
        },
      ]),
    );
    const r = patch([fixture({ profileId: rgbw.id })], [rgbw]);

    expect(channels(resolveFrames(s, r, play(s, ['pulse', 0]), 0, 1, 2), 4)).toEqual([
      128, 0, 0, 0,
    ]);
  });
});

describe('strobe', () => {
  const range = (from: number, to: number, capability: Capability): CapabilityRange => ({
    from,
    to,
    capability,
  });
  const control = (name: string, ranges: CapabilityRange[]): Channel => ({
    kind: 'control',
    name,
    defaultValue: 0,
    ranges,
  });
  const open = { type: 'shutter', effect: 'open' } as const;

  // Like the Smart Beam: a Shutter and a Ring Strobe, each 1–25 Hz.
  const beam = profile('test/beam', [
    channel('Dimmer', { type: 'intensity' }),
    control('Shutter', [
      range(0, 31, { type: 'shutter', effect: 'closed' }),
      range(32, 63, open),
      range(64, 95, { type: 'strobe', hz: [1, 25] }),
      range(96, 127, open),
    ]),
    control('Ring Strobe', [range(0, 0, open), range(1, 255, { type: 'strobe', hz: [1, 25] })]),
  ]);
  // A strobe range with no Hz span.
  const unspanned = profile('test/unspanned', [
    channel('Dimmer', { type: 'intensity' }),
    control('Strobe', [range(0, 9, open), range(10, 255, { type: 'strobe' })]),
  ]);
  // A narrow 4–10 Hz span.
  const narrow = profile('test/narrow', [
    channel('Dimmer', { type: 'intensity' }),
    control('Strobe', [range(0, 9, open), range(10, 255, { type: 'strobe', hz: [4, 10] })]),
  ]);
  // The strobe range turns strobe on; a speed channel sets the rate.
  const speed = profile('test/speed', [
    channel('Dimmer', { type: 'intensity' }),
    control('Shutter', [range(0, 127, open), range(128, 255, { type: 'strobe' })]),
    channel('Speed', { type: 'strobeSpeed', hz: [0.5, 15] }),
  ]);

  // The first channels of one Fixture of `p`, the Scenes played in order.
  function strobeOn(
    p: FixtureProfile,
    s: Show,
    steps: [string, number][],
    { grandMaster = 1, bpm = 120 } = {},
  ): number[] {
    const rig = patch([fixture({ profileId: p.id })], [p]);
    const frames = resolveFrames(s, rig, playOn(rig, s, ...steps), 10, grandMaster, 0, bpm);
    return channels(frames, p.modes[0]!.channels.length);
  }

  // One Fixture of `p` lit by one Rule with `strobe`.
  function strobing(p: FixtureProfile, strobe: Rule['strobe'], options = {}): number[] {
    const s = show(scene('s', [{ target: {}, intensity: 1, strobe }]));
    return strobeOn(p, s, [['s', 0]], options);
  }

  it('drives every strobe channel at the rate across its Hz span', () => {
    // 6 Hz is 5/24 of the way across 1–25 Hz.
    expect(strobing(beam, 'Medium')).toEqual([255, 70, 54]);
    expect(strobing(beam, 'Fast')).toEqual([255, 78, 117]);
  });

  it('keeps the shutter open when Off or not set', () => {
    expect(strobing(beam, 'Off')).toEqual([255, 47, 0]);
    expect(strobing(beam, undefined)).toEqual([255, 47, 0]);
  });

  it('takes a strobe range without a span as 1–20 Hz', () => {
    expect(strobing(unspanned, 'Slow')).toEqual([255, 23]);
    expect(strobing(unspanned, 'Fast')).toEqual([255, 152]);
  });

  it('clamps the rate to the span, above and below', () => {
    expect(strobing(narrow, 'Slow')).toEqual([255, 10]);
    expect(strobing(narrow, 'Medium')).toEqual([255, 92]);
    expect(strobing(narrow, 'Fast')).toEqual([255, 255]);
  });

  it('converts a beat rate to Hz from the Tempo', () => {
    // A 1/4 beat at 120 BPM is 8 Hz; at 60 BPM, 4 Hz.
    expect(strobing(narrow, 0.25)).toEqual([255, 173]);
    expect(strobing(narrow, 0.25, { bpm: 60 })).toEqual([255, 10]);
    // One beat at 480 BPM is 8 Hz.
    expect(strobing(narrow, 1, { bpm: 480 })).toEqual([255, 173]);
  });

  it('sets the rate on a strobe speed channel when the strobe range is elsewhere', () => {
    // 6 Hz is 11/29 of the way across 0.5–15 Hz.
    expect(strobing(speed, 'Medium')).toEqual([255, 191, 97]);
    expect(strobing(speed, 'Off')).toEqual([255, 63, 0]);
  });

  it('sets the rate on a strobe range without a span when the speed range shares its channel', () => {
    const shared = profile('test/shared', [
      channel('Dimmer', { type: 'intensity' }),
      control('Strobe', [
        range(0, 127, { type: 'strobe' }),
        range(128, 255, { type: 'strobeSpeed', hz: [1, 20] }),
      ]),
    ]);

    // 1–20 Hz assumed across the strobe range: 2 Hz is 1/19 of the way.
    expect(strobing(shared, 'Slow')).toEqual([255, 7]);
  });

  it('lets later Rules and higher Layers override it, Off included', () => {
    const s = show(
      scene('fast', [
        { target: {}, intensity: 1, strobe: 'Fast' },
        { target: {}, colour: { swatch: 'Red' } },
      ]),
      scene('stop', [
        { target: {}, intensity: 1, strobe: 'Medium' },
        { target: {}, strobe: 'Off' },
      ]),
      scene('dim', [{ target: {}, intensity: 0.5 }], { layer: 'l2' }),
      scene('off', [{ target: {}, strobe: 'Off' }], { layer: 'l2' }),
    );

    expect(strobeOn(narrow, s, [['fast', 0]])[1]).toBe(255);
    expect(strobeOn(narrow, s, [['stop', 0]])[1]).toBe(4);
    expect(
      strobeOn(narrow, s, [
        ['fast', 0],
        ['dim', 1],
      ])[1],
    ).toBe(255);
    expect(
      strobeOn(narrow, s, [
        ['fast', 0],
        ['off', 1],
      ])[1],
    ).toBe(4);
    expect(
      strobeOn(narrow, s, [
        ['off', 0],
        ['fast', 1],
      ])[1],
    ).toBe(255);
  });

  it('snaps on and off at Scene start, not crossfaded', () => {
    const s = show(
      scene('steady', [{ target: {}, intensity: 1 }]),
      scene('fast', [{ target: {}, intensity: 1, strobe: 'Fast' }], { fadeIn: 100 }),
      scene('calm', [{ target: {}, intensity: 1 }], { fadeIn: 100 }),
    );

    expect(
      strobeOn(narrow, s, [
        ['steady', 0],
        ['fast', 5],
      ])[1],
    ).toBe(255);
    expect(
      strobeOn(narrow, s, [
        ['fast', 0],
        ['calm', 5],
      ])[1],
    ).toBe(4);
  });

  it('gives dark on Blackout or at intensity 0', () => {
    expect(strobing(narrow, 'Fast', { grandMaster: 0 })).toEqual([0, 4]);
    const s = show(scene('s', [{ target: {}, intensity: 0, strobe: 'Fast' }]));
    expect(strobeOn(narrow, s, [['s', 0]])).toEqual([0, 4]);
  });

  it('leaves a Fixture with no strobe channel steady', () => {
    expect(strobing(dimmer, 'Fast')).toEqual([255]);
  });

  it('shows the rate in the preview, only on a lit Fixture that can strobe', () => {
    const lights = (p: FixtureProfile, intensity: number, strobe: Rule['strobe']) => {
      const s = show(scene('s', [{ target: {}, intensity, strobe }]));
      const rig = patch([fixture({ profileId: p.id })], [p]);
      return resolveLights(s, rig, play(s, ['s', 0]), 0, 1, 0, 60).f1!;
    };

    expect(lights(narrow, 1, 'Fast').strobe).toBe(12);
    expect(lights(narrow, 1, 0.5).strobe).toBe(2);
    expect(lights(narrow, 1, 'Off')).not.toHaveProperty('strobe');
    expect(lights(narrow, 0, 'Fast')).not.toHaveProperty('strobe');
    expect(lights(dimmer, 1, 'Fast')).not.toHaveProperty('strobe');
  });
});
