import { describe, expect, it } from 'vitest';
import type { FixtureProfile } from './fixture-profile';
import {
  addUniverse,
  emptyPatch,
  freeUniverseNumber,
  fixtureRole,
  fixturesInUniverse,
  fixtureZone,
  moveFixture,
  putFixture,
  putUniverse,
  removeFixture,
  removeUniverse,
  setStage,
  suggestZone,
  type PatchedFixture,
  type StageBounds,
  type VenuePatch,
} from './venue-patch';

// 12 m wide, 9 m deep: columns split at x = ±2, rows at y = 3 and 6.
const stage: StageBounds = { width: 12, depth: 9 };

describe('Zone suggestion', () => {
  it.each([
    { x: -4, y: 1, row: 'Downstage', column: 'Stage Right' },
    { x: 0, y: 1, row: 'Downstage', column: 'Centre' },
    { x: 4, y: 1, row: 'Downstage', column: 'Stage Left' },
    { x: -4, y: 4.5, row: 'Midstage', column: 'Stage Right' },
    { x: 0, y: 4.5, row: 'Midstage', column: 'Centre' },
    { x: 4, y: 4.5, row: 'Midstage', column: 'Stage Left' },
    { x: -4, y: 8, row: 'Upstage', column: 'Stage Right' },
    { x: 0, y: 8, row: 'Upstage', column: 'Centre' },
    { x: 4, y: 8, row: 'Upstage', column: 'Stage Left' },
  ])('puts ($x, $y) in $row $column', ({ x, y, row, column }) => {
    expect(suggestZone(stage, { x, y, height: 0 })).toEqual({ row, column, level: 'Floor' });
  });

  it.each([
    { x: -4, column: 'Stage Right' },
    { x: 0, column: 'Centre' },
    { x: 4, column: 'Stage Left' },
  ])('puts a Fixture in front of the stage at x = $x in the Front row', ({ x, column }) => {
    expect(suggestZone(stage, { x, y: -1.5, height: 0 })).toEqual({
      row: 'Front',
      column,
      level: 'Floor',
    });
  });

  it('suggests Overhead from 2 m up', () => {
    expect(suggestZone(stage, { x: 0, y: 1, height: 1.99 }).level).toBe('Floor');
    expect(suggestZone(stage, { x: 0, y: 1, height: 2 }).level).toBe('Overhead');
    expect(suggestZone(stage, { x: 0, y: -2, height: 6 })).toEqual({
      row: 'Front',
      column: 'Centre',
      level: 'Overhead',
    });
  });

  it('puts a Fixture on a boundary in the next cell upstage or toward Stage Left', () => {
    expect(suggestZone(stage, { x: 2, y: 3, height: 0 })).toEqual({
      row: 'Midstage',
      column: 'Stage Left',
      level: 'Floor',
    });
    expect(suggestZone(stage, { x: -2, y: 0, height: 0 })).toEqual({
      row: 'Downstage',
      column: 'Centre',
      level: 'Floor',
    });
  });

  it('puts a Fixture outside the stage in the nearest cell', () => {
    expect(suggestZone(stage, { x: -9, y: 12, height: 0 })).toEqual({
      row: 'Upstage',
      column: 'Stage Right',
      level: 'Floor',
    });
    expect(suggestZone(stage, { x: 9, y: -3, height: 0 })).toEqual({
      row: 'Front',
      column: 'Stage Left',
      level: 'Floor',
    });
  });

  it('puts a Fixture on a boundary of a decimal-sized stage in the next cell', () => {
    // Thirds at y = 4.1 and 8.2, and at x = ±1.05.
    const decimal = { width: 6.3, depth: 12.3 };

    expect(suggestZone(decimal, { x: -1.05, y: 4.1, height: 0 })).toEqual({
      row: 'Midstage',
      column: 'Centre',
      level: 'Floor',
    });
    expect(suggestZone(decimal, { x: 1.05, y: 8.2, height: 0 })).toEqual({
      row: 'Upstage',
      column: 'Stage Left',
      level: 'Floor',
    });
  });
});

// A 3-channel RGB par with a 4-channel mode that adds a dimmer.
const par: FixtureProfile = {
  id: 'acme/par',
  manufacturer: 'Acme',
  model: 'Par',
  defaultRole: 'Wash',
  modes: [
    { name: '3ch', channels: rgb() },
    {
      name: '4ch',
      channels: [
        {
          kind: 'control',
          name: 'Dimmer',
          defaultValue: 0,
          ranges: [{ from: 0, to: 255, capability: { type: 'intensity' } }],
        },
        ...rgb(),
      ],
    },
  ],
};

function rgb(): FixtureProfile['modes'][number]['channels'] {
  return (['red', 'green', 'blue'] as const).map((emitter) => ({
    kind: 'control',
    name: emitter,
    defaultValue: 0,
    ranges: [{ from: 0, to: 255, capability: { type: 'emitter', emitter } }],
  }));
}

function fixture(overrides: Partial<PatchedFixture> = {}): PatchedFixture {
  return {
    id: 'f1',
    name: 'Par 1',
    profileId: 'acme/par',
    mode: '3ch',
    universe: 1,
    address: 1,
    x: -4,
    y: 1,
    height: 0,
    ...overrides,
  };
}

function patched(patch: VenuePatch, ...fixtures: PatchedFixture[]): VenuePatch {
  for (const f of fixtures) {
    const result = putFixture(patch, f, par);
    if ('errors' in result) throw new Error(result.errors.join('\n'));
    patch = result.patch;
  }
  return patch;
}

describe('Venue Patch', () => {
  it('embeds a copy of the Profile of a patched Fixture', () => {
    const patch = patched(emptyPatch(stage), fixture());

    expect(patch.fixtures).toEqual([fixture()]);
    expect(patch.profiles).toEqual([par]);
  });

  it("gives a Fixture its suggested Zone and its Profile's Role unless overridden", () => {
    const plain = fixture();
    const overridden = fixture({
      id: 'f2',
      address: 10,
      role: 'Blinder',
      zone: { row: 'Upstage', column: 'Centre', level: 'Overhead' },
    });
    const patch = patched(emptyPatch(stage), plain, overridden);

    expect(fixtureZone(patch, plain)).toEqual({
      row: 'Downstage',
      column: 'Stage Right',
      level: 'Floor',
    });
    expect(fixtureRole(patch, plain)).toBe('Wash');
    expect(fixtureZone(patch, overridden)).toEqual({
      row: 'Upstage',
      column: 'Centre',
      level: 'Overhead',
    });
    expect(fixtureRole(patch, overridden)).toBe('Blinder');
  });

  it('rejects a Fixture whose channels overlap another Fixture in the same Universe', () => {
    // f1 occupies 1–3 in Universe 1.
    const patch = patched(emptyPatch(stage), fixture());

    expect(putFixture(patch, fixture({ id: 'f2', name: 'Par 2', address: 3 }), par)).toEqual({
      errors: ['"Par 2" (1.3–1.5) overlaps "Par 1" (1.1–1.3)'],
    });
    expect(
      putFixture(patch, fixture({ id: 'f2', mode: '4ch', address: 1, name: 'Par 2' }), par),
    ).toEqual({ errors: ['"Par 2" (1.1–1.4) overlaps "Par 1" (1.1–1.3)'] });
    expect('patch' in putFixture(patch, fixture({ id: 'f2', address: 4 }), par)).toBe(true);
  });

  it.each([
    { address: 0, error: '"Par 1": address must be a whole number from 1 to 512' },
    { address: 1.5, error: '"Par 1": address must be a whole number from 1 to 512' },
    { address: 511, error: '"Par 1" (1.511–1.513) runs past channel 512' },
  ])('rejects a Fixture at address $address', ({ address, error }) => {
    expect(putFixture(emptyPatch(stage), fixture({ address }), par)).toEqual({ errors: [error] });
  });

  it('accepts a Fixture ending on channel 512', () => {
    expect('patch' in putFixture(emptyPatch(stage), fixture({ address: 510 }), par)).toBe(true);
  });

  it('rejects a Fixture in a Universe, Profile or mode the patch lacks', () => {
    const patch = emptyPatch(stage);

    expect(putFixture(patch, fixture({ universe: 2 }), par)).toEqual({
      errors: ['"Par 1": Universe 2 is not in the patch'],
    });
    expect(putFixture(patch, fixture({ mode: '7ch' }), par)).toEqual({
      errors: ['"Par 1": mode "7ch" is not in Profile "acme/par"'],
    });
    expect(putFixture(patch, fixture({ profileId: 'acme/spot' }))).toEqual({
      errors: ['"Par 1": Profile "acme/spot" is not in the patch'],
    });
  });

  it('keeps its own copy of a Profile when the library copy has changed', () => {
    const patch = patched(emptyPatch(stage), fixture());
    const edited = { ...par, model: 'Par (edited)', modes: [par.modes[1]!] };

    const result = putFixture(patch, fixture({ id: 'f2', address: 4 }), edited);

    expect('patch' in result && result.patch.profiles).toEqual([par]);
  });

  it('drops a Profile copy once no Fixture uses it', () => {
    const patch = patched(emptyPatch(stage), fixture(), fixture({ id: 'f2', address: 4 }));

    const one = removeFixture(patch, 'f1');
    expect(one.fixtures.map((f) => f.id)).toEqual(['f2']);
    expect(one.profiles).toEqual([par]);
    expect(removeFixture(one, 'f2')).toEqual(emptyPatch(stage));
  });

  it('adds Universes and maps each to an Output', () => {
    let patch = emptyPatch(stage);
    for (const universe of [{ number: 2 }, { number: 1, output: 'usb-a' }]) {
      const result = putUniverse(patch, universe);
      if ('errors' in result) throw new Error(result.errors.join('\n'));
      patch = result.patch;
    }

    expect(patch.universes).toEqual([{ number: 1, output: 'usb-a' }, { number: 2 }]);
  });

  it('rejects a Universe number below 1 and two Universes on one Output', () => {
    const patch = emptyPatch(stage);
    const mapped = putUniverse(patch, { number: 1, output: 'usb-a' });
    if ('errors' in mapped) throw new Error(mapped.errors.join('\n'));

    expect(putUniverse(patch, { number: 0 })).toEqual({
      errors: ['Universe 0: number must be a whole number from 1'],
    });
    expect(putUniverse(mapped.patch, { number: 2, output: 'usb-a' })).toEqual({
      errors: ['Universes 1 and 2 are both mapped to Output "usb-a"'],
    });
  });

  it('removes the Fixtures of a removed Universe', () => {
    let patch = patched(emptyPatch(stage), fixture());
    const two = putUniverse(patch, { number: 2 });
    if ('errors' in two) throw new Error(two.errors.join('\n'));
    patch = patched(two.patch, fixture({ id: 'f2', universe: 2 }));

    const removed = removeUniverse(patch, 2);

    expect(removed.universes).toEqual([{ number: 1 }]);
    expect(removed.fixtures.map((f) => f.id)).toEqual(['f1']);
    expect(removeUniverse(removed, 1)).toEqual({ ...emptyPatch(stage), universes: [] });
  });

  it('re-suggests Zones when the stage bounds change', () => {
    const patch = patched(emptyPatch(stage), fixture({ x: -4, y: 1 }));

    const result = setStage(patch, { width: 30, depth: 3 });

    if ('errors' in result) throw new Error(result.errors.join('\n'));
    expect(fixtureZone(result.patch, fixture())).toEqual({
      row: 'Midstage',
      column: 'Centre',
      level: 'Floor',
    });
  });

  it('rejects stage bounds that are not positive', () => {
    expect(setStage(emptyPatch(stage), { width: 0, depth: -1 })).toEqual({
      errors: ['Stage width and depth must be greater than 0'],
    });
  });

  it('rejects a Fixture whose position is not a number', () => {
    expect(putFixture(emptyPatch(stage), fixture({ x: NaN }), par)).toEqual({
      errors: ['"Par 1": x, y and height must be numbers'],
    });
  });

  it('rejects a Profile that is not the one the Fixture names', () => {
    expect(putFixture(emptyPatch(stage), fixture(), { ...par, id: 'acme/spot' })).toEqual({
      errors: ['"Par 1": Profile "acme/spot" given for Profile "acme/par"'],
    });
  });

  it('rejects a Fixture in a mode without channels', () => {
    const empty = { ...par, modes: [{ name: '0ch', channels: [] }] };

    expect(putFixture(emptyPatch(stage), fixture({ mode: '0ch' }), empty)).toEqual({
      errors: ['"Par 1": mode "0ch" has no channels'],
    });
  });
});

describe('Moving a Fixture', () => {
  it('updates its suggested Zone', () => {
    const patch = patched(emptyPatch(stage), fixture({ x: -4, y: 1 }));

    const moved = moveFixture(patch, 'f1', { x: 4, y: 8, height: 3 });

    if ('errors' in moved) throw new Error(moved.errors.join('\n'));
    expect(fixtureZone(moved.patch, moved.patch.fixtures[0]!)).toEqual({
      row: 'Upstage',
      column: 'Stage Left',
      level: 'Overhead',
    });
  });

  it('keeps a Zone override', () => {
    const zone = { row: 'Front', column: 'Centre', level: 'Floor' } as const;
    const patch = patched(emptyPatch(stage), fixture({ zone }));

    const moved = moveFixture(patch, 'f1', { x: 4, y: 8, height: 3 });

    if ('errors' in moved) throw new Error(moved.errors.join('\n'));
    expect(fixtureZone(moved.patch, moved.patch.fixtures[0]!)).toEqual(zone);
  });

  it('rejects a Fixture that is not in the patch', () => {
    expect(moveFixture(emptyPatch(stage), 'nope', { x: 0, y: 0, height: 0 })).toEqual({
      errors: ['Fixture id "nope" is not in the patch'],
    });
  });
});

describe('Fixtures in a Universe', () => {
  it('lists only the Fixtures patched in that Universe', () => {
    const two = putUniverse(emptyPatch(stage), { number: 2 });
    if ('errors' in two) throw new Error(two.errors.join('\n'));
    const patch = patched(
      two.patch,
      fixture({ id: 'a', name: 'A' }),
      fixture({ id: 'b', name: 'B', universe: 2 }),
      fixture({ id: 'c', name: 'C', address: 10 }),
    );

    expect(fixturesInUniverse(patch, 1).map((f) => f.name)).toEqual(['A', 'C']);
    expect(fixturesInUniverse(patch, 2).map((f) => f.name)).toEqual(['B']);
    expect(fixturesInUniverse(patch, 3)).toEqual([]);
  });
});

describe('Adding a Universe', () => {
  it('adds a Universe by number, in number order', () => {
    const three = addUniverse(emptyPatch(stage), { number: 3 });
    if ('errors' in three) throw new Error(three.errors.join('\n'));

    const two = addUniverse(three.patch, { number: 2, output: 'usb-1' });

    if ('errors' in two) throw new Error(two.errors.join('\n'));
    expect(two.patch.universes).toEqual([
      { number: 1 },
      { number: 2, output: 'usb-1' },
      { number: 3 },
    ]);
  });

  it('rejects a number already in the patch, keeping that Universe', () => {
    const mapped = putUniverse(emptyPatch(stage), { number: 1, output: 'usb-1' });
    if ('errors' in mapped) throw new Error(mapped.errors.join('\n'));

    expect(addUniverse(mapped.patch, { number: 1 })).toEqual({
      errors: ['Universe 1 is already in the patch'],
    });
  });

  it('suggests the lowest number not in use', () => {
    expect(freeUniverseNumber(emptyPatch(stage))).toBe(2);
    const gap = addUniverse(emptyPatch(stage), { number: 3 });
    if ('errors' in gap) throw new Error(gap.errors.join('\n'));
    expect(freeUniverseNumber(gap.patch)).toBe(2);
    expect(freeUniverseNumber(removeUniverse(gap.patch, 1))).toBe(1);
  });
});
