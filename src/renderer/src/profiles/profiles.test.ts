import { describe, expect, it } from 'vitest';
import type { FixtureProfile } from '../../../shared/fixture-profile';
import type { ProfileLibraryEntry } from '../../../shared/protocol';
import { blankChannel } from '../../../shared/profile-edit';
import { filterProfiles, modeSummary, sameProfile } from './profiles';

const profile = (manufacturer: string, model: string, counts: number[]): FixtureProfile => ({
  id: `${manufacturer}/${model}`.toLowerCase(),
  manufacturer,
  model,
  defaultRole: 'Wash',
  modes: counts.map((count) => ({
    name: `${count}ch`,
    channels: Array.from({ length: count }, (_, i) => blankChannel(`Channel ${i + 1}`)),
  })),
});

const entry = (p: FixtureProfile): ProfileLibraryEntry => ({ profile: p, handEdited: false });

const par = profile('Acme', 'Par', [3, 6]);
const spot = profile('Beamco', 'Spot 200', [16]);
const wash = profile('acme', 'Wash', [8]);

describe('filterProfiles', () => {
  const entries = [par, spot, wash].map(entry);

  it('keeps every Profile for an empty query', () => {
    expect(filterProfiles(entries, '  ')).toEqual(entries);
  });

  it('matches manufacturer and model, ignoring case', () => {
    expect(filterProfiles(entries, 'ACME').map((e) => e.profile)).toEqual([par, wash]);
    expect(filterProfiles(entries, 'spot').map((e) => e.profile)).toEqual([spot]);
  });

  it('matches across manufacturer and model', () => {
    expect(filterProfiles(entries, 'acme par').map((e) => e.profile)).toEqual([par]);
  });
});

describe('modeSummary', () => {
  it('names one mode with its channel count', () => {
    expect(modeSummary(spot)).toBe('1 mode · 16ch');
  });

  it('gives the channel range of several modes', () => {
    expect(modeSummary(par)).toBe('2 modes · 3–6ch');
  });

  it('gives one count when every mode has it', () => {
    expect(modeSummary(profile('Acme', 'Bar', [4, 4]))).toBe('2 modes · 4ch');
  });
});

describe('sameProfile', () => {
  it('is true for equal Profiles with keys in another order', () => {
    const reordered: FixtureProfile = {
      modes: par.modes,
      defaultRole: par.defaultRole,
      model: par.model,
      manufacturer: par.manufacturer,
      id: par.id,
    };
    expect(sameProfile(par, reordered)).toBe(true);
  });

  it('counts a key set to undefined as absent', () => {
    const range = { from: 0, to: 255, capability: { type: 'intensity' as const } };
    const cleared = { ...range, capability: { type: 'intensity' as const, level: undefined } };
    const withRange = (r: typeof range): FixtureProfile => ({
      ...spot,
      modes: [
        {
          name: '1ch',
          channels: [{ kind: 'control', name: 'Dimmer', defaultValue: 0, ranges: [r] }],
        },
      ],
    });
    expect(sameProfile(withRange(range), withRange(cleared))).toBe(true);
  });

  it('is false when a channel differs', () => {
    const changed = { ...par, modes: [{ ...par.modes[0]!, channels: [] }, par.modes[1]!] };
    expect(sameProfile(par, changed)).toBe(false);
  });
});
