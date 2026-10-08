import { describe, expect, it } from 'vitest';
import type { Capability, Channel, FixtureProfile } from './fixture-profile';
import type { Rule, Show } from './show';
import { DEFAULT_MOUNTING, type PatchedFixture, type VenuePatch } from './venue-patch';
import { approximatedAims } from './venue-check';

function control(name: string, capability: Capability): Channel {
  return { kind: 'control', name, defaultValue: 0, ranges: [{ from: 0, to: 255, capability }] };
}

const dimmer = control('Dimmer', { type: 'intensity' });
const pan = control('Pan', { type: 'pan', degrees: [0, 540] });
const tilt = control('Tilt', { type: 'tilt', degrees: [-135, 135] });

function profile(id: string, channels: Channel[]): FixtureProfile {
  return {
    id,
    manufacturer: 'Test',
    model: id,
    defaultRole: 'Spot/Beam',
    modes: [{ name: 'mode', channels }],
  };
}

const mover = profile('test/mover', [dimmer, pan, tilt]);
// A moving head whose Profile gives no degrees.
const bare = profile('test/bare', [
  dimmer,
  control('Pan', { type: 'pan' }),
  control('Tilt', { type: 'tilt' }),
]);
// A moving head whose Profile gives pan degrees only.
const noTiltDegrees = profile('test/no-tilt-degrees', [
  dimmer,
  pan,
  control('Tilt', { type: 'tilt' }),
]);
// A bar that only tilts.
const bar = profile('test/bar', [dimmer, tilt]);
const par = profile('test/par', [dimmer]);

function fixture(id: string, profileId: string, overrides: Partial<PatchedFixture> = {}) {
  return {
    id,
    name: id,
    profileId,
    mode: 'mode',
    universe: 1,
    address: 1,
    // Hung over Downstage Stage Left.
    x: 3,
    y: 2,
    height: 6,
    ...overrides,
  };
}

function patch(...fixtures: PatchedFixture[]): VenuePatch {
  return {
    stage: { width: 10, depth: 8 },
    universes: [{ number: 1 }],
    fixtures: fixtures.map((f, i) => ({ ...f, address: 1 + i * 3 })),
    profiles: [mover, bare, noTiltDegrees, bar, par],
  };
}

function show(rules: Rule[], overrides: Partial<Show> = {}): Show {
  return {
    layers: [{ id: 'l1', name: 'Layer 1' }],
    scenes: [{ id: 's1', name: 'Scene', tags: [], layer: 'l1', fadeIn: 0, rules }],
    triggers: [],
    ...overrides,
  };
}

describe('approximatedAims', () => {
  it('lists nothing for aims a mover reaches exactly', () => {
    const rig = patch(fixture('head', mover.id));

    expect(approximatedAims(show([{ target: {}, direction: 'Audience' }]), rig)).toEqual([]);
  });

  it('skips Fixtures that do not move', () => {
    expect(
      approximatedAims(show([{ target: {}, direction: 'Up' }]), patch(fixture('par', par.id))),
    ).toEqual([]);
  });

  it('reports assumed pan and tilt ranges, at the Default Direction', () => {
    const rig = patch(fixture('head', bare.id));

    expect(approximatedAims(show([]), rig)).toEqual([
      {
        fixtureId: 'head',
        direction: 'Down',
        approximations: ['assumedPanRange', 'assumedTiltRange'],
      },
    ]);
  });

  it('reports an assumed tilt range on its own', () => {
    const rig = patch(fixture('head', noTiltDegrees.id));

    expect(approximatedAims(show([]), rig)).toEqual([
      { fixtureId: 'head', direction: 'Down', approximations: ['assumedTiltRange'] },
    ]);
  });

  it('reports an aim out of reach, at a changed Default Direction', () => {
    const rig = patch(fixture('head', mover.id));

    expect(approximatedAims(show([], { defaultDirection: 'Up' }), rig)).toEqual([
      { fixtureId: 'head', direction: 'Up', approximations: ['outOfReach'] },
    ]);
  });

  it('reports an aim that needs a missing axis', () => {
    // Facing Stage Right, the bar tilts only across the stage.
    const rig = patch(fixture('bar', bar.id, { mounting: { ...DEFAULT_MOUNTING, rotation: 90 } }));

    expect(approximatedAims(show([{ target: {}, direction: 'Audience' }]), rig)).toEqual([
      { fixtureId: 'bar', direction: 'Audience', approximations: ['missingAxis'] },
    ]);
  });

  it('checks a Rule’s Direction only on the movers it targets', () => {
    const rig = patch(fixture('spot', mover.id), fixture('wash', mover.id, { role: 'Wash' }));
    const s = show([{ target: { roles: ['Wash'] }, direction: 'Up' }]);

    expect(approximatedAims(s, rig)).toEqual([
      { fixtureId: 'wash', direction: 'Up', approximations: ['outOfReach'] },
    ]);
  });

  it('lists each mover × Direction once, in patch and Direction order', () => {
    const rig = patch(fixture('a', bare.id), fixture('b', mover.id));
    const s = show([
      { target: {}, direction: 'Up' },
      { target: {}, direction: 'Audience' },
      { target: {}, direction: 'Up' },
    ]);

    expect(
      approximatedAims(s, rig).map(({ fixtureId, direction }) => [fixtureId, direction]),
    ).toEqual([
      ['a', 'Down'],
      ['a', 'Audience'],
      ['a', 'Up'],
      ['b', 'Up'],
    ]);
  });
});
