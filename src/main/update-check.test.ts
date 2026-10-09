import { describe, expect, it, vi } from 'vitest';
import {
  CHECK_INTERVAL_MS,
  createUpdateCheck,
  isReleasePageUrl,
  type UpdateCheckOptions,
} from './update-check';

const RELEASE_URL = 'https://github.com/GiorgosKoulouris/LightCues/releases/tag/v0.2.0';
const NOW = Date.parse('2026-10-09T12:00:00Z');

function release(tag: string, more: object = {}): unknown {
  return { tag_name: tag, html_url: RELEASE_URL, prerelease: false, draft: false, ...more };
}

// A check against a fake GitHub that answers `body`, with storage in memory.
function setup(body: unknown = release('v0.2.0'), more: Partial<UpdateCheckOptions> = {}) {
  let saved: string | undefined = more.storage?.read();
  const storage = { read: () => saved, write: (json: string) => (saved = json) };
  const fetch = vi.fn(async () => Response.json(body));
  const log = vi.fn();
  const check = createUpdateCheck({
    currentVersion: '0.1.1',
    fetch,
    now: () => NOW,
    storage,
    log,
    ...more,
  });
  return { check, fetch, log, saved: () => saved };
}

describe('update check', () => {
  it('asks GitHub for the latest release', async () => {
    const { check, fetch } = setup();
    await check.run();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/GiorgosKoulouris/LightCues/releases/latest',
      expect.anything(),
    );
  });

  it('reports a newer release', async () => {
    const { check } = setup(release('v0.2.0'));
    expect(await check.run()).toEqual({ version: '0.2.0', url: RELEASE_URL });
  });

  it('compares versions numerically', async () => {
    const { check } = setup(release('v0.1.10'));
    expect(await check.run()).toMatchObject({ version: '0.1.10' });
  });

  it('reports nothing for the same version', async () => {
    const { check } = setup(release('v0.1.1'));
    expect(await check.run()).toBeUndefined();
  });

  it('reports nothing for an older version', async () => {
    const { check } = setup(release('v0.0.9'));
    expect(await check.run()).toBeUndefined();
  });

  it('ignores a prerelease', async () => {
    expect(await setup(release('v0.2.0-beta.1')).check.run()).toBeUndefined();
    expect(await setup(release('v0.2.0', { prerelease: true })).check.run()).toBeUndefined();
  });

  it('ignores a malformed response, and logs it', async () => {
    for (const body of [null, 'text', {}, release('latest'), release('v0.2.0', { html_url: 7 })]) {
      const { check, log } = setup(body);
      expect(await check.run()).toBeUndefined();
      expect(log).toHaveBeenCalled();
    }
  });

  it('ignores a release page outside the project', async () => {
    const { check, log } = setup(release('v0.2.0', { html_url: 'https://example.com/' }));
    expect(await check.run()).toBeUndefined();
    expect(log).toHaveBeenCalled();
  });

  it('ignores an HTTP error, and logs it', async () => {
    const fetch = vi.fn(async () => new Response('rate limited', { status: 403 }));
    const { check, log } = setup(undefined, { fetch });
    expect(await check.run()).toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('403'));
  });

  it('fails silently on a network error, and logs it', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const { check, log } = setup(undefined, { fetch });
    await expect(check.run()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('fetch failed'));
  });

  it('checks at most once a day', async () => {
    let now = NOW;
    const { check, fetch } = setup(release('v0.2.0'), { now: () => now });
    await check.run();
    now += CHECK_INTERVAL_MS - 1;
    await check.run();
    expect(fetch).toHaveBeenCalledTimes(1);
    now += 1;
    await check.run();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('remembers the last check across launches', async () => {
    const first = setup(release('v0.2.0'));
    await first.check.run();
    const storage = { read: first.saved, write: () => {} };
    const second = setup(release('v0.2.0'), { storage });
    // Within the day: no request, but the release found before still shows.
    expect(await second.check.run()).toEqual({ version: '0.2.0', url: RELEASE_URL });
    expect(second.fetch).not.toHaveBeenCalled();
  });

  it('forgets a remembered release once the app is updated to it', async () => {
    const first = setup(release('v0.2.0'));
    await first.check.run();
    const storage = { read: first.saved, write: () => {} };
    const second = setup(release('v0.2.0'), { storage, currentVersion: '0.2.0' });
    expect(await second.check.run()).toBeUndefined();
  });

  it('waits a day after a failure too, and keeps the release found before', async () => {
    let now = NOW;
    let fail = false;
    const fetch = vi.fn(async () => {
      if (fail) throw new TypeError('fetch failed');
      return Response.json(release('v0.2.0'));
    });
    const { check } = setup(undefined, { fetch, now: () => now });
    await check.run();
    fail = true;
    now += CHECK_INTERVAL_MS;
    expect(await check.run()).toEqual({ version: '0.2.0', url: RELEASE_URL });
    now += CHECK_INTERVAL_MS - 1;
    await check.run();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('ignores a prerelease suffix on the running version', async () => {
    const { check } = setup(release('v0.2.0'), { currentVersion: '0.2.0-dev' });
    expect(await check.run()).toBeUndefined();
    const older = setup(release('v0.2.0'), { currentVersion: '0.1.1-dev' });
    expect(await older.check.run()).toMatchObject({ version: '0.2.0' });
  });

  it('is on by default', () => {
    expect(setup().check.enabled()).toBe(true);
  });

  it('makes no request when turned off', async () => {
    const { check, fetch } = setup();
    check.setEnabled(false);
    expect(await check.run()).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('remembers the setting across launches', () => {
    const first = setup();
    first.check.setEnabled(false);
    const second = setup(undefined, { storage: { read: first.saved, write: () => {} } });
    expect(second.check.enabled()).toBe(false);
  });

  it('still reports when the last check cannot be saved, and logs it', async () => {
    const storage = {
      read: () => undefined,
      write: () => {
        throw new Error('disk full');
      },
    };
    const { check, log } = setup(release('v0.2.0'), { storage });
    expect(await check.run()).toMatchObject({ version: '0.2.0' });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('disk full'));
  });

  it('starts fresh from unreadable storage', async () => {
    const { check, fetch } = setup(release('v0.2.0'), {
      storage: { read: () => '{not json', write: () => {} },
    });
    expect(check.enabled()).toBe(true);
    await check.run();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('isReleasePageUrl', () => {
  it('allows a release page of the project', () => {
    expect(isReleasePageUrl(RELEASE_URL)).toBe(true);
    expect(isReleasePageUrl('https://github.com/GiorgosKoulouris/LightCues/releases/latest')).toBe(
      true,
    );
  });

  it('denies any other URL', () => {
    for (const url of [
      'https://github.com/GiorgosKoulouris/LightCues',
      'https://github.com/GiorgosKoulouris/LightCues/releases',
      'https://github.com/GiorgosKoulouris/LightCues/issues/1',
      'https://github.com/Someone/LightCues/releases/tag/v0.2.0',
      'http://github.com/GiorgosKoulouris/LightCues/releases/tag/v0.2.0',
      'https://github.com.example.com/GiorgosKoulouris/LightCues/releases/tag/v0.2.0',
      'https://user@github.com/GiorgosKoulouris/LightCues/releases/tag/v0.2.0',
      'https://github.com:8443/GiorgosKoulouris/LightCues/releases/tag/v0.2.0',
      'https://github.com/GiorgosKoulouris/LightCues/releases/../../../evil',
      'file:///C:/Windows/System32/calc.exe',
      'javascript:alert(1)',
      'not a url',
    ]) {
      expect(isReleasePageUrl(url), url).toBe(false);
    }
  });

  it('denies a value that is not a string', () => {
    expect(isReleasePageUrl(undefined)).toBe(false);
    expect(isReleasePageUrl({ toString: () => RELEASE_URL })).toBe(false);
  });
});
