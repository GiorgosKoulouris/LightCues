import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkElectron, RELEASES_URL } from './electron.mjs';

// Trimmed real releases feed and GitHub release notes. The CVE line in the
// 44.5.0 notes is made up.
const fixture = (name) =>
  JSON.parse(readFileSync(join(import.meta.dirname, 'testdata', `${name}.json`), 'utf8'));
const releases = fixture('electron-releases');
const notes = fixture('electron-notes');

const fetchers = {
  fetchReleases: async () => releases,
  fetchNotes: async (version) => notes[version] ?? '',
};

describe('checkElectron', () => {
  it('reports an installed latest patch as up to date', async () => {
    const result = await checkElectron('44.7.0', fetchers);

    expect(result).toEqual({
      source: RELEASES_URL,
      installed: '44.7.0',
      major: 44,
      supportedMajors: [44, 43, 42],
      supported: true,
      latestPatch: '44.7.0',
      upToDate: true,
      newerPatches: [],
      error: null,
    });
  });

  it('lists the newer patches with their security note lines', async () => {
    const result = await checkElectron('44.5.0', fetchers);

    expect(result).toMatchObject({ supported: true, latestPatch: '44.7.0', upToDate: false });
    expect(result.newerPatches).toEqual([
      {
        version: '44.7.0',
        date: '2026-10-07',
        chrome: '152.0.7977.130',
        securityNotes: [
          'Backported fixes from upstream ANGLE, Chromium, Dawn, fontconfig, Skia, V8 and WebRTC. [#54666](https://github.com/electron/electron/pull/54666)',
          'Backported fixes from upstream ANGLE, Chromium, Skia, V8 and WebRTC. [#54657](https://github.com/electron/electron/pull/54657)',
        ],
        notesError: null,
      },
      {
        version: '44.6.0',
        date: '2026-10-05',
        chrome: '152.0.7977.130',
        securityNotes: [],
        notesError: null,
      },
      {
        version: '44.5.1',
        date: '2026-09-29',
        chrome: '152.0.7977.130',
        securityNotes: [
          'Backported fixes from upstream ANGLE, Chromium, Dawn and V8. [#54564](https://github.com/electron/electron/pull/54564)',
        ],
        notesError: null,
      },
    ]);
  });

  it('keeps CVE lines and skips lines that only say "security key"', async () => {
    const result = await checkElectron('44.0.0', fetchers);

    const patch = result.newerPatches.find((p) => p.version === '44.5.0');
    expect(patch.securityNotes).toEqual(['Security: backported fix for CVE-2099-0002.']);
  });

  it('flags a major outside the latest 3 stable majors', async () => {
    const result = await checkElectron('41.10.6', fetchers);

    expect(result).toMatchObject({
      major: 41,
      supportedMajors: [44, 43, 42],
      supported: false,
      latestPatch: '41.10.7',
      upToDate: false,
    });
    expect(result.newerPatches.map((p) => p.version)).toEqual(['41.10.7']);
  });

  it('ignores nightlies, alphas and betas', async () => {
    const result = await checkElectron('44.0.0', fetchers);

    expect(result.supportedMajors).toEqual([44, 43, 42]);
    expect(result.newerPatches.map((p) => p.version)).toEqual([
      '44.7.0',
      '44.6.0',
      '44.5.1',
      '44.5.0',
    ]);
  });

  it('records a feed error and lists nothing else', async () => {
    const result = await checkElectron('44.6.0', {
      ...fetchers,
      fetchReleases: async () => {
        throw new Error('getaddrinfo ENOTFOUND releases.electronjs.org');
      },
    });

    expect(result).toEqual({
      source: RELEASES_URL,
      installed: '44.6.0',
      major: 44,
      supportedMajors: null,
      supported: null,
      latestPatch: null,
      upToDate: null,
      newerPatches: null,
      error: 'getaddrinfo ENOTFOUND releases.electronjs.org',
    });
  });

  it('records a notes error on the patch and keeps the rest', async () => {
    const result = await checkElectron('44.6.0', {
      ...fetchers,
      fetchNotes: async () => {
        throw new Error('HTTP 403');
      },
    });

    expect(result.error).toBeNull();
    expect(result.newerPatches).toEqual([
      {
        version: '44.7.0',
        date: '2026-10-07',
        chrome: '152.0.7977.130',
        securityNotes: null,
        notesError: 'HTTP 403',
      },
    ]);
  });

  it('records an error when Electron is not in the inventory', async () => {
    const result = await checkElectron(null, fetchers);

    expect(result).toMatchObject({
      installed: null,
      supported: null,
      error: 'Electron is not in the inventory.',
    });
  });

  it('records an error for a prerelease', async () => {
    const result = await checkElectron('45.0.0-beta.1', fetchers);

    expect(result).toMatchObject({
      major: null,
      supported: null,
      error: '45.0.0-beta.1 is not a stable release.',
    });
  });
});
