import { describe, expect, it } from 'vitest';
import type { FixtureMode } from './fixture-profile';
import { profileId, renameChannel } from './profile-edit';

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
