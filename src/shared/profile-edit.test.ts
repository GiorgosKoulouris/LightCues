import { describe, expect, it } from 'vitest';
import type { FixtureMode } from './fixture-profile';
import { blankProfile, profileId, profileName, renameChannel, byHand } from './profile-edit';

describe('profile editing', () => {
  it('derives the Profile id from manufacturer and model', () => {
    expect(profileId('Acme Lighting', 'LED Bar 2 (RGB)')).toBe('acme-lighting/led-bar-2-rgb');
  });

  it('keeps fine channels linked when their control channel is renamed', () => {
    const mode: FixtureMode = {
      name: '16bit',
      channels: [
        { kind: 'control', name: 'Pan', defaultValue: 128, ranges: [] },
        { kind: 'fine', name: 'Pan fine', of: 'Pan', byte: 1, defaultValue: 0 },
        { kind: 'unused' },
      ],
    };

    expect(renameChannel(mode, 0, 'Pan coarse').channels).toEqual([
      { kind: 'control', name: 'Pan coarse', defaultValue: 128, ranges: [] },
      { kind: 'fine', name: 'Pan fine', of: 'Pan coarse', byte: 1, defaultValue: 0 },
      { kind: 'unused' },
    ]);
  });
});

describe('byHand', () => {
  it('clears the assumed flag of a span edited by hand', () => {
    expect(byHand({ type: 'strobe', hz: [1, 20], assumed: true })).toStrictEqual({
      type: 'strobe',
      hz: [1, 20],
    });
    expect(byHand({ type: 'intensity', level: [0.05, 1] })).toStrictEqual({
      type: 'intensity',
      level: [0.05, 1],
    });
  });
});

describe('profileName', () => {
  it('joins manufacturer and model', () => {
    expect(profileName({ ...blankProfile(), manufacturer: 'Acme', model: 'Par' })).toBe('Acme Par');
  });

  it('has no stray space while one is empty', () => {
    expect(profileName({ ...blankProfile(), manufacturer: 'Acme' })).toBe('Acme');
  });
});
