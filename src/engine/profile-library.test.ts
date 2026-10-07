import { describe, expect, it } from 'vitest';
import type {
  CapabilityRange,
  Channel,
  FixtureMode,
  FixtureProfile,
} from '../shared/fixture-profile';
import { createProfileLibrary } from './profile-library';

const meta = { authors: ['test'], createDate: '2026-01-01', lastModifyDate: '2026-01-01' };

const red: CapabilityRange = { from: 0, to: 255, capability: { type: 'emitter', emitter: 'red' } };

const green: CapabilityRange = {
  from: 0,
  to: 255,
  capability: { type: 'emitter', emitter: 'green' },
};

const redChannel: Channel = { kind: 'control', name: 'Red', defaultValue: 0, ranges: [red] };

function oflDimmer(name: string, modeName = '1ch') {
  return {
    name,
    categories: ['Dimmer'],
    meta,
    availableChannels: { Dimmer: { capability: { type: 'Intensity' } } },
    modes: [{ name: modeName, channels: ['Dimmer'] }],
  };
}

describe('Profile Library', () => {
  it('lists imported Profiles by manufacturer then model', () => {
    const library = createProfileLibrary();

    library.importOfl(oflDimmer('Par 64'), 'Showtec');
    library.importOfl(oflDimmer('Zed Par'), 'Cameo');
    library.importOfl(oflDimmer('Flat Pro'), 'Cameo');

    expect(library.list().map((p) => p.id)).toEqual([
      'cameo/flat-pro',
      'cameo/zed-par',
      'showtec/par-64',
    ]);
    expect(library.get('showtec/par-64')?.model).toBe('Par 64');
    expect(library.get('missing/profile')).toBeUndefined();
  });

  it('returns the import report', () => {
    const library = createProfileLibrary();

    const { profile, unsupported } = library.importOfl(
      {
        ...oflDimmer('Hazer'),
        availableChannels: { Dimmer: { capability: { type: 'Fog' } } },
      },
      'Generic',
    );

    expect(profile.id).toBe('generic/hazer');
    expect(unsupported).toEqual([{ channel: 'Dimmer', feature: 'Fog' }]);
  });

  it('replaces a Profile when the same fixture is imported again', () => {
    const library = createProfileLibrary();

    library.importOfl(oflDimmer('Par 64', 'Old'), 'Showtec');
    library.importOfl(oflDimmer('Par 64', 'New'), 'Showtec');

    expect(library.list()).toHaveLength(1);
    expect(library.get('showtec/par-64')?.modes[0]?.name).toBe('New');
  });

  it('restores its Profiles from saved JSON', () => {
    const library = createProfileLibrary();
    library.importOfl(oflDimmer('Par 64'), 'Showtec');

    const restored = createProfileLibrary(library.save());

    expect(restored.list()).toEqual(library.list());
    expect(JSON.parse(library.save())).toMatchObject({ version: 2 });
  });

  it('restores which Profiles were edited by hand', () => {
    const library = createProfileLibrary();
    library.importOfl(oflDimmer('Par 64'), 'Showtec');
    library.put(handMade());

    const restored = createProfileLibrary(library.save());

    expect(restored.isHandEdited('acme/led-bar')).toBe(true);
    expect(restored.isHandEdited('showtec/par-64')).toBe(false);
  });

  it('reads version 1 files, where no Profile is hand-edited', () => {
    const v1 = createProfileLibrary(JSON.stringify({ version: 1, profiles: [handMade()] }));

    expect(v1.get('acme/led-bar')).toEqual(handMade());
    expect(v1.isHandEdited('acme/led-bar')).toBe(false);
  });

  it('rejects saved JSON from an unknown version', () => {
    expect(() => createProfileLibrary(JSON.stringify({ version: 3, profiles: [] }))).toThrow(
      'Unsupported Profile Library version: 3',
    );
  });
});

function handMade(overrides: Partial<FixtureProfile> = {}): FixtureProfile {
  return {
    id: 'acme/led-bar',
    manufacturer: 'Acme',
    model: 'LED Bar',
    defaultRole: 'Pixel/Bar',
    modes: [
      {
        name: '3ch',
        channels: [
          { kind: 'control', name: 'Red', defaultValue: 0, ranges: [red] },
          { kind: 'control', name: 'Green', defaultValue: 0, ranges: [green] },
          { kind: 'unused' },
        ],
      },
    ],
    ...overrides,
  };
}

describe('Profile Library: hand-made Profiles', () => {
  it('saves a Profile made from scratch and marks it hand-edited', () => {
    const library = createProfileLibrary();

    expect(library.put(handMade())).toEqual([]);

    expect(library.get('acme/led-bar')).toEqual(handMade());
    expect(library.isHandEdited('acme/led-bar')).toBe(true);
  });

  it('reports a conflict instead of overwriting a hand-edited Profile on re-import', () => {
    const library = createProfileLibrary();
    library.importOfl(oflDimmer('Par 64', 'Imported'), 'Showtec');
    expect(library.isHandEdited('showtec/par-64')).toBe(false);
    const edited = library.get('showtec/par-64')!;
    library.put({ ...edited, defaultRole: 'Blinder' }, { replaces: edited.id });

    const result = library.importOfl(oflDimmer('Par 64', 'Reimported'), 'Showtec');

    expect(result.status).toBe('conflict');
    expect(result.profile.modes[0]?.name).toBe('Reimported');
    expect(library.get('showtec/par-64')?.defaultRole).toBe('Blinder');
    expect(library.isHandEdited('showtec/par-64')).toBe(true);
  });

  it('overwrites a hand-edited Profile when the import is confirmed', () => {
    const library = createProfileLibrary();
    library.importOfl(oflDimmer('Par 64'), 'Showtec');
    library.put(
      { ...library.get('showtec/par-64')!, defaultRole: 'Blinder' },
      { replaces: 'showtec/par-64' },
    );

    const result = library.importOfl(oflDimmer('Par 64'), 'Showtec', { overwrite: true });

    expect(result.status).toBe('imported');
    expect(library.get('showtec/par-64')?.defaultRole).toBe('Wash');
    expect(library.isHandEdited('showtec/par-64')).toBe(false);
  });

  it.each<[string, FixtureProfile, string]>([
    ['a blank model', handMade({ model: ' ' }), 'Model is required'],
    ['no modes', handMade({ modes: [] }), 'At least one mode is required'],
    [
      'duplicate mode names',
      handMade({ modes: [mode('3ch', [redChannel]), mode('3ch', [redChannel])] }),
      'Mode name "3ch" is used twice',
    ],
    ['an empty mode', handMade({ modes: [mode('0ch', [])] }), 'Mode "0ch" has no channels'],
    [
      'duplicate channel names',
      handMade({ modes: [mode('2ch', [redChannel, redChannel])] }),
      'Mode "2ch": channel name "Red" is used twice',
    ],
    [
      'a default value out of range',
      handMade({ modes: [mode('1ch', [{ ...redChannel, defaultValue: 256 }])] }),
      'Mode "1ch", channel 1 "Red": default value must be a whole number from 0 to 255',
    ],
    [
      'overlapping ranges',
      handMade({
        modes: [mode('1ch', [{ ...redChannel, ranges: [range(0, 127), range(100, 255)] }])],
      }),
      'Mode "1ch", channel 1 "Red": ranges 0–127 and 100–255 overlap',
    ],
    [
      'a reversed range',
      handMade({ modes: [mode('1ch', [{ ...redChannel, ranges: [range(200, 100)] }])] }),
      'Mode "1ch", channel 1 "Red": range 200–100 must run from low to high within 0–255',
    ],
    [
      'a channel without ranges',
      handMade({ modes: [mode('1ch', [{ ...redChannel, ranges: [] }])] }),
      'Mode "1ch", channel 1 "Red": at least one range is required',
    ],
    [
      'a fine channel of a missing channel',
      handMade({
        modes: [
          mode('2ch', [
            redChannel,
            { kind: 'fine', name: 'Pan fine', of: 'Pan', byte: 1, defaultValue: 0 },
          ]),
        ],
      }),
      'Mode "2ch", channel 2 "Pan fine": fine channel of "Pan", which is not in this mode',
    ],
    [
      'a bad wheel colour',
      handMade({
        modes: [
          mode('1ch', [
            {
              ...redChannel,
              ranges: [
                {
                  from: 0,
                  to: 255,
                  capability: { type: 'wheelSlot', slot: { name: 'X', colour: 'red' } },
                },
              ],
            },
          ]),
        ],
      }),
      'Mode "1ch", channel 1 "Red": wheel slot "X" colour must be #rrggbb',
    ],
  ])('rejects a Profile with %s', (_, profile, error) => {
    const library = createProfileLibrary();

    expect(library.put(profile)).toContain(error);
    expect(library.get(profile.id)).toBeUndefined();
  });

  it('refuses a new Profile whose id is already taken', () => {
    const library = createProfileLibrary();
    library.put(handMade());

    expect(library.put(handMade({ defaultRole: 'Wash' }))).toEqual([
      'A Profile with id "acme/led-bar" already exists',
    ]);
    expect(library.get('acme/led-bar')?.defaultRole).toBe('Pixel/Bar');
  });

  it('saves changes to an existing Profile', () => {
    const library = createProfileLibrary();
    library.put(handMade());

    expect(library.put(handMade({ defaultRole: 'Wash' }), { replaces: 'acme/led-bar' })).toEqual(
      [],
    );
    expect(library.get('acme/led-bar')?.defaultRole).toBe('Wash');
  });

  it('renames a Profile when its id changes on save', () => {
    const library = createProfileLibrary();
    library.put(handMade());

    library.put(handMade({ id: 'acme/led-bar-2', model: 'LED Bar 2' }), {
      replaces: 'acme/led-bar',
    });

    expect(library.list().map((p) => p.id)).toEqual(['acme/led-bar-2']);
  });

  it('refuses a rename onto another Profile', () => {
    const library = createProfileLibrary();
    library.put(handMade());
    library.put(handMade({ id: 'acme/other', model: 'Other' }));

    expect(library.put(handMade({ id: 'acme/other' }), { replaces: 'acme/led-bar' })).toEqual([
      'A Profile with id "acme/other" already exists',
    ]);
    expect(library.list()).toHaveLength(2);
  });

  it('deletes a Profile', () => {
    const library = createProfileLibrary();
    library.put(handMade());

    library.remove('acme/led-bar');

    expect(library.get('acme/led-bar')).toBeUndefined();
    expect(library.isHandEdited('acme/led-bar')).toBe(false);
  });
});

function mode(name: string, channels: Channel[]): FixtureMode {
  return { name, channels };
}

function range(from: number, to: number): CapabilityRange {
  return { from, to, capability: { type: 'intensity' } };
}
