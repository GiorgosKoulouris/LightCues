import { describe, expect, it } from 'vitest';
import type { FixtureProfile } from '../shared/fixture-profile';
import {
  DEFAULT_MOUNTING,
  emptyPatch,
  fixtureRole,
  patchProfile,
  putFixture,
  type PatchedFixture,
  type VenuePatch,
} from '../shared/venue-patch';
import { createProfileLibrary } from './profile-library';
import { loadVenueFile, saveVenueFile } from './venue-file';

const meta = { authors: ['test'], createDate: '2026-01-01', lastModifyDate: '2026-01-01' };

const handMade: FixtureProfile = {
  id: 'acme/led-bar',
  manufacturer: 'Acme',
  model: 'LED Bar',
  defaultRole: 'Pixel/Bar',
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

function fixture(overrides: Partial<PatchedFixture>): PatchedFixture {
  return {
    id: 'f1',
    name: 'Fixture',
    profileId: '',
    mode: '1ch',
    universe: 1,
    address: 1,
    x: 0,
    y: 0,
    height: 0,
    ...overrides,
  };
}

function patch(...entries: [PatchedFixture, FixtureProfile][]): VenuePatch {
  let result: VenuePatch = emptyPatch({ width: 10, depth: 6 });
  for (const [f, profile] of entries) {
    const put = putFixture(result, f, profile);
    if ('errors' in put) throw new Error(put.errors.join('\n'));
    result = put.patch;
  }
  return result;
}

describe('.lcvenue file', () => {
  it('opens on a machine whose Profile Library lacks its Profiles', () => {
    const library = createProfileLibrary();
    expect(library.put(handMade)).toEqual([]);
    library.importOfl(
      {
        name: 'Par 64',
        categories: ['Dimmer'],
        meta,
        availableChannels: { Dimmer: { capability: { type: 'Intensity' } } },
        modes: [{ name: '1ch', channels: ['Dimmer'] }],
      },
      'Showtec',
    );
    const bar = fixture({ id: 'bar', profileId: 'acme/led-bar' });
    const par = fixture({ id: 'par', profileId: 'showtec/par-64', address: 2 });
    const saved = saveVenueFile(
      patch([bar, library.get('acme/led-bar')!], [par, library.get('showtec/par-64')!]),
    );

    // Nothing from the library is needed to open the file.
    const opened = loadVenueFile(saved);

    expect(opened.fixtures).toEqual([bar, par]);
    expect(patchProfile(opened, bar)).toEqual(handMade);
    expect(patchProfile(opened, par).model).toBe('Par 64');
    expect(fixtureRole(opened, bar)).toBe('Pixel/Bar');
  });

  it("keeps each Fixture's Mounting", () => {
    const mounting = { ...DEFAULT_MOUNTING, mount: 'Standing' as const, rotation: 270 };
    const hung = fixture({ id: 'hung', profileId: 'acme/led-bar' });
    const standing = fixture({ id: 'standing', profileId: 'acme/led-bar', address: 2, mounting });
    const saved = saveVenueFile(patch([hung, handMade], [standing, handMade]));

    expect(JSON.parse(saved).version).toBe(2);
    expect(loadVenueFile(saved).fixtures).toEqual([hung, standing]);
  });

  it('opens a version 1 file, whose Fixtures have no Mounting', () => {
    const bar = fixture({ profileId: 'acme/led-bar' });
    const v1 = {
      version: 1,
      stage: { width: 10, depth: 6 },
      universes: [{ number: 1 }],
      fixtures: [bar],
      profiles: [handMade],
    };

    expect(loadVenueFile(JSON.stringify(v1)).fixtures).toEqual([bar]);
  });

  it('rejects a Mounting rotation outside 0 to under 360', () => {
    const saved = JSON.parse(
      saveVenueFile(patch([fixture({ profileId: 'acme/led-bar' }), handMade])),
    );
    saved.fixtures[0].mounting = { ...DEFAULT_MOUNTING, rotation: 360 };

    expect(() => loadVenueFile(JSON.stringify(saved))).toThrow(
      'Invalid Venue Patch:\n"Fixture": Mounting rotation must be 0 to under 360',
    );
  });

  it('rejects a file of an unknown version', () => {
    const saved = JSON.parse(saveVenueFile(emptyPatch({ width: 10, depth: 6 })));

    expect(() => loadVenueFile(JSON.stringify({ ...saved, version: 99 }))).toThrow(
      'Unsupported Venue Patch version: 99',
    );
  });

  it('rejects a file whose patch is invalid', () => {
    const saved = JSON.parse(
      saveVenueFile(patch([fixture({ profileId: 'acme/led-bar' }), handMade])),
    );
    saved.fixtures.push({ ...saved.fixtures[0], id: 'f2', name: 'Copy' });
    saved.fixtures.push({ ...saved.fixtures[0], address: 600 });

    expect(() => loadVenueFile(JSON.stringify(saved))).toThrow(
      [
        'Invalid Venue Patch:',
        '"Copy" (1.1–1.1) overlaps "Fixture" (1.1–1.1)',
        '"Fixture": address must be a whole number from 1 to 512',
        'Fixture id "f1" is used twice',
      ].join('\n'),
    );
  });

  it('rejects a file with unknown overrides or a repeated Profile', () => {
    const saved = JSON.parse(
      saveVenueFile(patch([fixture({ profileId: 'acme/led-bar' }), handMade])),
    );
    saved.fixtures.push({
      ...saved.fixtures[0],
      id: 'f2',
      name: 'Second',
      address: 2,
      zone: { row: 'Balcony', column: 'Centre', level: 'Floor' },
    });
    saved.fixtures[0].role = 'Laser';
    saved.profiles.push(handMade);

    expect(() => loadVenueFile(JSON.stringify(saved))).toThrow(
      [
        'Invalid Venue Patch:',
        '"Fixture": Role "Laser" is not a Role',
        '"Second": Zone Balcony/Centre/Floor is not on the stage grid',
        'Profile "acme/led-bar" is embedded twice',
      ].join('\n'),
    );
  });

  it('rejects a file that is not a Venue Patch', () => {
    expect(() =>
      loadVenueFile(JSON.stringify({ version: 1, stage: { width: 1, depth: 1 } })),
    ).toThrow('Invalid Venue Patch: stage, universes, fixtures and profiles are required');
  });

  it('refuses to save an invalid patch', () => {
    const valid = patch([fixture({ profileId: 'acme/led-bar' }), handMade]);

    expect(() => saveVenueFile({ ...valid, stage: { width: 0, depth: 6 } })).toThrow(
      'Invalid Venue Patch:\nStage width and depth must be greater than 0',
    );
  });
});
