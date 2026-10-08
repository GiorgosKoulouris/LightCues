import { describe, expect, it } from 'vitest';
import type { FixtureProfile } from '../../../shared/fixture-profile';
import { emptyPatch, type PatchedFixture, type VenuePatch } from '../../../shared/venue-patch';
import {
  filterFixtures,
  fixtureGroup,
  MIXED,
  nextAddress,
  selectFixture,
  shared,
  sortFixtures,
} from './fixtures';

const par: FixtureProfile = {
  id: 'acme/par',
  manufacturer: 'Acme',
  model: 'Par',
  defaultRole: 'Wash',
  modes: [
    {
      name: '3ch',
      channels: ['Red', 'Green', 'Blue'].map((name) => ({
        kind: 'control' as const,
        name,
        defaultValue: 0,
        ranges: [],
      })),
    },
  ],
};

const fixture = (id: string, more: Partial<PatchedFixture> = {}): PatchedFixture => ({
  id,
  name: id,
  profileId: 'acme/par',
  mode: '3ch',
  universe: 1,
  address: 1,
  x: 0,
  y: 1,
  height: 0,
  ...more,
});

// 12 m wide, 9 m deep: columns split at x = ±2, rows at y = 3 and 6.
const patch: VenuePatch = {
  ...emptyPatch({ width: 12, depth: 9 }),
  universes: [{ number: 1 }, { number: 2 }],
  profiles: [par],
  fixtures: [
    fixture('Spot B', { universe: 2, address: 10, x: -4, y: 8 }),
    fixture('Wash A', { address: 4, x: 4, y: 1 }),
    fixture('Wash B', { address: 1, x: -4, y: 1, height: 5 }),
  ],
};

const ids = (fixtures: PatchedFixture[]) => fixtures.map((f) => f.id);

describe('Fixture list', () => {
  it('finds Fixtures by name, Profile or address', () => {
    expect(ids(filterFixtures(patch, 'wash'))).toEqual(['Wash A', 'Wash B']);
    expect(ids(filterFixtures(patch, 'acme par'))).toHaveLength(3);
    expect(ids(filterFixtures(patch, '2.10'))).toEqual(['Spot B']);
    expect(ids(filterFixtures(patch, '  '))).toHaveLength(3);
  });

  it('groups by Universe in address order', () => {
    const sorted = sortFixtures(patch, patch.fixtures, 'universe');
    expect(ids(sorted)).toEqual(['Wash B', 'Wash A', 'Spot B']);
    expect(sorted.map((f) => fixtureGroup(patch, f, 'universe'))).toEqual([
      'Universe 1',
      'Universe 1',
      'Universe 2',
    ]);
  });

  it('groups by Zone, Floor before Overhead and front to back', () => {
    const sorted = sortFixtures(patch, patch.fixtures, 'zone');
    expect(ids(sorted)).toEqual(['Wash A', 'Spot B', 'Wash B']);
    expect(sorted.map((f) => fixtureGroup(patch, f, 'zone'))).toEqual([
      'Downstage Stage Left Floor',
      'Upstage Stage Right Floor',
      'Downstage Stage Right Overhead',
    ]);
  });

  it('suggests the address after the last Fixture in a Universe', () => {
    expect(nextAddress(patch, 1)).toBe(7);
    expect(nextAddress(patch, 2)).toBe(13);
    expect(nextAddress({ ...patch, fixtures: [] }, 1)).toBe(1);
  });
});

describe('Fixture selection', () => {
  const order = ['a', 'b', 'c', 'd', 'e'];
  const none = { ids: [] };

  it('selects one Fixture on a plain click', () => {
    expect(selectFixture({ ids: ['a', 'b'], anchor: 'a' }, 'c', order, {})).toEqual({
      ids: ['c'],
      anchor: 'c',
      current: 'c',
    });
  });

  it('toggles a Fixture with Ctrl', () => {
    const one = selectFixture(none, 'b', order, {});
    const two = selectFixture(one, 'd', order, { toggle: true });
    expect(two).toEqual({ ids: ['b', 'd'], anchor: 'd', current: 'd' });
    expect(selectFixture(two, 'b', order, { toggle: true })).toEqual({
      ids: ['d'],
      anchor: 'b',
      current: 'b',
    });
  });

  it('selects a range from the anchor with Shift, in list order', () => {
    const anchored = selectFixture(none, 'd', order, {});
    expect(selectFixture(anchored, 'b', order, { range: true })).toEqual({
      ids: ['b', 'c', 'd'],
      anchor: 'd',
      current: 'b',
    });
  });

  it('adds a range with Ctrl+Shift', () => {
    const picked = selectFixture({ ids: ['a'], anchor: 'a' }, 'c', order, { toggle: true });
    expect(selectFixture(picked, 'e', order, { range: true, toggle: true })).toEqual({
      ids: ['a', 'c', 'd', 'e'],
      anchor: 'c',
      current: 'e',
    });
  });

  it('moves the current Fixture with each click, so Shift+Arrow grows the range', () => {
    const anchored = selectFixture(none, 'b', order, {});
    const one = selectFixture(anchored, 'c', order, { range: true });
    expect(one.current).toBe('c');
    expect(selectFixture(one, 'd', order, { range: true }).ids).toEqual(['b', 'c', 'd']);
  });

  it('keeps selected Fixtures the search hides when adding a range', () => {
    const picked = { ids: ['hidden', 'a'], anchor: 'a', current: 'a' };
    expect(selectFixture(picked, 'b', order, { range: true, toggle: true }).ids).toEqual([
      'hidden',
      'a',
      'b',
    ]);
  });

  it('selects just the Fixture when the anchor is not listed', () => {
    expect(selectFixture({ ids: ['x'], anchor: 'x' }, 'b', order, { range: true })).toEqual({
      ids: ['b'],
      anchor: 'b',
      current: 'b',
    });
  });
});

describe('shared field values', () => {
  it('gives the value all share, or MIXED', () => {
    expect(shared([1, 1, 1])).toBe(1);
    expect(shared(['Wash', 'Strobe'])).toBe(MIXED);
  });
});
