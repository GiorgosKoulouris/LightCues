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
  addressProblem,
  DEFAULT_MOUNTING,
  fixtureMounting,
  isMovingFixture,
  putFixture,
  putFixtures,
  patchHouse,
  putHouseGroup,
  putHouseLight,
  putUniverse,
  removeFixtures,
  removeHouseGroup,
  removeHouseLights,
  removeUniverse,
  setStage,
  setStartupLook,
  suggestZone,
  validatePatch,
  type HouseLight,
  type HouseLook,
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

    const one = removeFixtures(patch, ['f1']);
    expect(one.fixtures.map((f) => f.id)).toEqual(['f2']);
    expect(one.profiles).toEqual([par]);
    expect(removeFixtures(one, ['f2'])).toEqual(emptyPatch(stage));
  });

  it('removes several Fixtures at once', () => {
    const patch = patched(
      emptyPatch(stage),
      fixture(),
      fixture({ id: 'f2', address: 4 }),
      fixture({ id: 'f3', address: 7 }),
    );

    expect(removeFixtures(patch, ['f1', 'f3']).fixtures.map((f) => f.id)).toEqual(['f2']);
  });

  it('puts several Fixtures in one change, checked as a whole', () => {
    const patch = patched(emptyPatch(stage), fixture(), fixture({ id: 'f2', address: 4 }));

    // Swapping addresses only fits when both move together.
    const swapped = putFixtures(patch, [
      fixture({ address: 4 }),
      fixture({ id: 'f2', address: 1 }),
    ]);
    expect('patch' in swapped && swapped.patch.fixtures.map((f) => f.address)).toEqual([4, 1]);

    const clash = putFixtures(patch, [
      fixture({ role: 'Strobe' }),
      fixture({ id: 'f2', address: 2 }),
    ]);
    expect(clash).toEqual({ errors: ['"Par 1" (1.2–1.4) overlaps "Par 1" (1.1–1.3)'] });
  });

  it('embeds the Profile of each new Fixture put together', () => {
    const result = putFixtures(emptyPatch(stage), [fixture()], (id) =>
      id === par.id ? par : undefined,
    );

    expect('patch' in result && result.patch.profiles).toEqual([par]);
  });

  it("tells why a Fixture's address does not fit", () => {
    const patch = patched(
      emptyPatch(stage),
      fixture(),
      fixture({ id: 'f2', name: 'Par 2', address: 4 }),
    );
    const f1 = patch.fixtures[0]!;

    expect(addressProblem(patch, f1)).toBeUndefined();
    expect(addressProblem(patch, { ...f1, address: 3 })).toBe('Overlaps Par 2 (1.4–1.6)');
    expect(addressProblem(patch, { ...f1, address: 511 })).toBe('Runs past channel 512');
    expect(addressProblem(patch, { ...f1, address: 0 })).toBe('Must be 1–512');
    expect(addressProblem(patch, { ...f1, universe: 2, address: 4 })).toBeUndefined();
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

  it('maps any number of Universes to the Virtual Output', () => {
    let patch = emptyPatch(stage);
    for (const number of [1, 2]) {
      const result = putUniverse(patch, { number, output: 'virtual' });
      if ('errors' in result) throw new Error(result.errors.join('\n'));
      patch = result.patch;
    }

    expect(patch.universes).toEqual([
      { number: 1, output: 'virtual' },
      { number: 2, output: 'virtual' },
    ]);
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

// A moving head with pan and tilt, and a mode with tilt only.
const head: FixtureProfile = {
  id: 'acme/head',
  manufacturer: 'Acme',
  model: 'Head',
  defaultRole: 'Spot/Beam',
  modes: [
    {
      name: 'basic',
      channels: [
        {
          kind: 'control',
          name: 'Pan',
          defaultValue: 128,
          ranges: [{ from: 0, to: 255, capability: { type: 'pan', degrees: [0, 540] } }],
        },
        {
          kind: 'control',
          name: 'Tilt',
          defaultValue: 128,
          ranges: [{ from: 0, to: 255, capability: { type: 'tilt' } }],
        },
      ],
    },
    {
      name: 'tilt only',
      channels: [
        {
          kind: 'control',
          name: 'Tilt',
          defaultValue: 128,
          ranges: [{ from: 0, to: 255, capability: { type: 'tilt' } }],
        },
      ],
    },
  ],
};

function withHead(...fixtures: PatchedFixture[]): VenuePatch {
  const result = putFixtures(emptyPatch(stage), fixtures, (id) => (id === head.id ? head : par));
  if ('errors' in result) throw new Error(result.errors.join('\n'));
  return result.patch;
}

describe('Mounting', () => {
  const mover = (overrides: Partial<PatchedFixture> = {}) =>
    fixture({ id: 'm1', name: 'Head 1', profileId: 'acme/head', mode: 'basic', ...overrides });

  it('defaults to Hung, 0°, no inverts and no offsets', () => {
    expect(DEFAULT_MOUNTING).toEqual({
      mount: 'Hung',
      rotation: 0,
      panInvert: false,
      tiltInvert: false,
      panOffset: 0,
      tiltOffset: 0,
    });
    expect(fixtureMounting(mover())).toEqual(DEFAULT_MOUNTING);
  });

  it("keeps a Fixture's Mounting", () => {
    const mounting = {
      mount: 'Standing' as const,
      rotation: 90,
      panInvert: true,
      tiltInvert: false,
      panOffset: -2.5,
      tiltOffset: 4,
    };
    const patch = withHead(mover({ mounting }));

    expect(fixtureMounting(patch.fixtures[0]!)).toEqual(mounting);
  });

  it.each([
    { rotation: 360, normalised: 0 },
    { rotation: 450, normalised: 90 },
    { rotation: -90, normalised: 270 },
    { rotation: 359.5, normalised: 359.5 },
  ])('normalises a rotation of $rotation° to $normalised°', ({ rotation, normalised }) => {
    const patch = withHead(mover({ mounting: { ...DEFAULT_MOUNTING, rotation } }));

    expect(fixtureMounting(patch.fixtures[0]!).rotation).toBe(normalised);
  });

  it.each(['rotation', 'panOffset', 'tiltOffset'] as const)(
    'rejects a %s that is not a number',
    (field) => {
      const result = putFixture(
        emptyPatch(stage),
        mover({ mounting: { ...DEFAULT_MOUNTING, [field]: Infinity } }),
        head,
      );

      expect(result).toEqual({
        errors: ['"Head 1": Mounting rotation and offsets must be numbers'],
      });
    },
  );

  it('rejects an unknown mount or a non-boolean invert', () => {
    const odd = { ...DEFAULT_MOUNTING, mount: 'Sideways' } as unknown as PatchedFixture['mounting'];
    expect(putFixture(emptyPatch(stage), mover({ mounting: odd }), head)).toEqual({
      errors: ['"Head 1": Mounting "Sideways" is not Hung or Standing'],
    });

    const invert = {
      ...DEFAULT_MOUNTING,
      tiltInvert: 'yes',
    } as unknown as PatchedFixture['mounting'];
    expect(putFixture(emptyPatch(stage), mover({ mounting: invert }), head)).toEqual({
      errors: ['"Head 1": Mounting inverts must be true or false'],
    });
  });

  it('calls a Fixture whose mode has a pan or tilt channel a moving Fixture', () => {
    const patch = withHead(
      mover(),
      mover({ id: 'm2', mode: 'tilt only', address: 10 }),
      fixture({ address: 20 }),
    );
    const [both, tiltOnly, still] = patch.fixtures;

    expect(isMovingFixture(patch, both!)).toBe(true);
    expect(isMovingFixture(patch, tiltOnly!)).toBe(true);
    expect(isMovingFixture(patch, still!)).toBe(false);
  });
});

// A dimmer-only Profile, as many house lights are.
const dimmer: FixtureProfile = {
  id: 'acme/dimmer',
  manufacturer: 'Acme',
  model: 'Dimmer',
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
};

function houseLight(overrides: Partial<HouseLight> = {}): HouseLight {
  return {
    id: 'h1',
    name: 'Bar 1',
    group: 'bar',
    profileId: 'acme/dimmer',
    mode: '1ch',
    universe: 1,
    address: 100,
    ...overrides,
  };
}

function ok(result: ReturnType<typeof putHouseLight>): VenuePatch {
  if ('errors' in result) throw new Error(result.errors.join('\n'));
  return result.patch;
}

// A patch with a Bar House Group holding `lights`.
function withBar(patch: VenuePatch, ...lights: HouseLight[]): VenuePatch {
  patch = ok(putHouseGroup(patch, { id: 'bar', name: 'Bar' }));
  for (const light of lights) patch = ok(putHouseLight(patch, light, dimmer));
  return patch;
}

describe('House Lights', () => {
  it('has no House Groups, House Lights or Startup look in a new patch', () => {
    expect(patchHouse(emptyPatch(stage))).toEqual({ groups: [], lights: [] });
  });

  it('adds a House Group and a House Light in it, embedding its Profile', () => {
    const patch = withBar(emptyPatch(stage), houseLight());

    expect(patchHouse(patch)).toEqual({
      groups: [{ id: 'bar', name: 'Bar' }],
      lights: [houseLight()],
    });
    expect(patch.profiles).toEqual([dimmer]);
    expect(patch.fixtures).toEqual([]);
  });

  it('renames a House Group and edits a House Light in place', () => {
    let patch = withBar(emptyPatch(stage), houseLight(), houseLight({ id: 'h2', address: 101 }));

    patch = ok(putHouseGroup(patch, { id: 'bar', name: 'Back bar' }));
    patch = ok(putHouseLight(patch, houseLight({ name: 'Bar left', address: 110 })));

    expect(patchHouse(patch).groups).toEqual([{ id: 'bar', name: 'Back bar' }]);
    expect(patchHouse(patch).lights.map((l) => [l.name, l.address])).toEqual([
      ['Bar left', 110],
      ['Bar 1', 101],
    ]);
  });

  it('rejects a House Light in a Group the patch lacks', () => {
    expect(
      putHouseLight(withBar(emptyPatch(stage)), houseLight({ group: 'ceiling' }), dimmer),
    ).toEqual({ errors: ['"Bar 1": House Group "ceiling" is not in the patch'] });
  });

  it('rejects a House Light in a Universe, Profile or mode the patch lacks', () => {
    const patch = withBar(emptyPatch(stage));

    expect(putHouseLight(patch, houseLight({ universe: 2 }), dimmer)).toEqual({
      errors: ['"Bar 1": Universe 2 is not in the patch'],
    });
    expect(putHouseLight(patch, houseLight({ mode: '3ch' }), dimmer)).toEqual({
      errors: ['"Bar 1": mode "3ch" is not in Profile "acme/dimmer"'],
    });
    expect(putHouseLight(patch, houseLight({ profileId: 'acme/spot' }))).toEqual({
      errors: ['"Bar 1": Profile "acme/spot" is not in the patch'],
    });
  });

  it('checks House Lights and stage Fixtures together for overlaps', () => {
    // Par 1 occupies 1.1–1.3.
    const patch = withBar(patched(emptyPatch(stage), fixture()));

    expect(putHouseLight(patch, houseLight({ address: 3 }), dimmer)).toEqual({
      errors: ['"Bar 1" (1.3–1.3) overlaps "Par 1" (1.1–1.3)'],
    });
    const lit = ok(putHouseLight(patch, houseLight({ address: 4 }), dimmer));
    expect(putFixture(lit, fixture({ id: 'f2', name: 'Par 2', address: 2 }))).toEqual({
      errors: [
        '"Par 2" (1.2–1.4) overlaps "Par 1" (1.1–1.3)',
        '"Bar 1" (1.4–1.4) overlaps "Par 2" (1.2–1.4)',
      ],
    });
    expect(addressProblem(lit, fixture({ address: 2 }))).toBe('Overlaps Bar 1 (1.4–1.4)');
    expect(addressProblem(lit, houseLight({ id: 'h2', address: 3 }))).toBe(
      'Overlaps Par 1 (1.1–1.3)',
    );
  });

  it('rejects a House Light with the id of a stage Fixture', () => {
    const patch = withBar(patched(emptyPatch(stage), fixture()));

    expect(putHouseLight(patch, houseLight({ id: 'f1' }), dimmer)).toEqual({
      errors: ['Fixture id "f1" is used twice'],
    });
  });

  it('removes House Lights, dropping a Profile copy no one uses', () => {
    const patch = withBar(emptyPatch(stage), houseLight(), houseLight({ id: 'h2', address: 101 }));

    const one = removeHouseLights(patch, ['h1']);
    expect(patchHouse(one).lights.map((l) => l.id)).toEqual(['h2']);
    expect(one.profiles).toEqual([dimmer]);
    expect(removeHouseLights(one, ['h2']).profiles).toEqual([]);
  });

  it('removes a House Group with its House Lights and its part of the Startup look', () => {
    let patch = withBar(emptyPatch(stage), houseLight());
    patch = ok(putHouseGroup(patch, { id: 'ceiling', name: 'Ceiling' }));
    patch = ok(putHouseLight(patch, houseLight({ id: 'h2', group: 'ceiling', address: 200 })));
    const look: HouseLook = {
      bar: { intensity: 0.5, colour: { swatch: 'Amber' } },
      ceiling: { intensity: 1, colour: { swatch: 'White' } },
    };
    patch = ok(setStartupLook(patch, look));

    const removed = removeHouseGroup(patch, 'bar');

    expect(patchHouse(removed)).toEqual({
      groups: [{ id: 'ceiling', name: 'Ceiling' }],
      lights: [houseLight({ id: 'h2', group: 'ceiling', address: 200 })],
      startupLook: { ceiling: look.ceiling },
    });
  });

  it('removes the House Lights of a removed Universe', () => {
    const two = putUniverse(emptyPatch(stage), { number: 2 });
    if ('errors' in two) throw new Error(two.errors.join('\n'));
    const patch = withBar(two.patch, houseLight(), houseLight({ id: 'h2', universe: 2 }));

    expect(patchHouse(removeUniverse(patch, 2)).lights.map((l) => l.id)).toEqual(['h1']);
  });

  it('sets and clears the Startup look', () => {
    const patch = withBar(emptyPatch(stage), houseLight());
    const look: HouseLook = { bar: { intensity: 0.3, colour: { hue: 30, saturation: 0.5 } } };

    const lit = ok(setStartupLook(patch, look));
    expect(patchHouse(lit).startupLook).toEqual(look);
    expect(patchHouse(ok(setStartupLook(lit, undefined)))).toEqual(patchHouse(patch));
  });

  it('rejects a Startup look for an unknown Group, or with a bad intensity or colour', () => {
    const patch = withBar(emptyPatch(stage));
    const white = { swatch: 'White' } as const;

    expect(setStartupLook(patch, { ceiling: { intensity: 1, colour: white } })).toEqual({
      errors: ['Startup look: House Group "ceiling" is not in the patch'],
    });
    expect(setStartupLook(patch, { bar: { intensity: 1.5, colour: white } })).toEqual({
      errors: ['Startup look: "Bar" intensity must be from 0 to 1'],
    });
    expect(
      setStartupLook(patch, { bar: { intensity: 1, colour: { hue: 400, saturation: 1 } } }),
    ).toEqual({
      errors: ['Startup look: "Bar" hue must be from 0 to under 360'],
    });
  });

  it('rejects two House Groups with one id', () => {
    const patch = withBar(emptyPatch(stage));

    expect(
      validatePatch({
        ...patch,
        house: {
          ...patchHouse(patch),
          groups: [
            { id: 'bar', name: 'Bar' },
            { id: 'bar', name: 'Bar 2' },
          ],
        },
      }),
    ).toEqual(['House Group id "bar" is used twice']);
  });
});
