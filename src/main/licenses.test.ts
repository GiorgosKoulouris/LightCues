import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { licensePath } from './licenses';

const RESOURCES = join('C:', 'Program Files', 'LightCues', 'resources');

describe('licensePath', () => {
  it('maps each license file to its fixed path in the resources folder', () => {
    expect(licensePath('license', RESOURCES)).toBe(join(RESOURCES, 'LICENSE.txt'));
    expect(licensePath('thirdPartyNotices', RESOURCES)).toBe(
      join(RESOURCES, 'THIRD_PARTY_NOTICES.txt'),
    );
  });

  it('refuses anything else from the renderer', () => {
    expect(licensePath('toString', RESOURCES)).toBeUndefined();
    expect(licensePath('__proto__', RESOURCES)).toBeUndefined();
    expect(licensePath('../../Windows/win.ini', RESOURCES)).toBeUndefined();
    expect(licensePath(join(RESOURCES, 'LICENSE.txt'), RESOURCES)).toBeUndefined();
    expect(licensePath(undefined, RESOURCES)).toBeUndefined();
    expect(licensePath({ toString: () => 'license' }, RESOURCES)).toBeUndefined();
  });
});
