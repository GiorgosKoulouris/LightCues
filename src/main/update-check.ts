// Checks GitHub for a newer release. Check only: nothing is downloaded or
// installed, so a live tool never changes mid-gig. See ADR 0012.
import type { UpdateAvailable } from '../shared/protocol';

const LATEST_RELEASE_API =
  'https://api.github.com/repos/GiorgosKoulouris/LightCues/releases/latest';
const RELEASES_PATH = '/GiorgosKoulouris/LightCues/releases/';
// `vX.Y.Z`, maybe with a prerelease suffix.
const VERSION_TAG = /^v?(\d+\.\d+\.\d+(?:-[\w.]+)?)$/;

// At most one request a day.
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Where the setting and the last check are kept between runs.
export interface UpdateCheckStorage {
  // The saved JSON, or undefined when nothing is saved yet.
  read(): string | undefined;
  write(json: string): void;
}

export interface UpdateCheckOptions {
  // The running version, `X.Y.Z`.
  currentVersion: string;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  now: () => number;
  storage: UpdateCheckStorage;
  // Failures go here, never to the user.
  log: (message: string) => void;
}

interface Saved {
  enabled: boolean;
  checkedAt?: number;
  // The latest release found by a check that worked, so a throttled launch
  // still shows it.
  latest?: UpdateAvailable;
}

export function createUpdateCheck({
  currentVersion,
  fetch,
  now,
  storage,
  log,
}: UpdateCheckOptions) {
  const saved = read(storage);

  // A failed write is logged; the check then runs again next launch.
  function save(): void {
    try {
      storage.write(JSON.stringify(saved));
    } catch (error) {
      log(`Update check not saved: ${message(error)}`);
    }
  }

  // The remembered release, if it is newer than the running version.
  function newer(): UpdateAvailable | undefined {
    const { latest } = saved;
    return latest && isNewer(latest.version, currentVersion) ? latest : undefined;
  }

  // The latest stable release, or undefined when it is a prerelease. Throws
  // on any failure.
  async function fetchLatest(): Promise<UpdateAvailable | undefined> {
    const response = await fetch(LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseRelease(await response.json());
  }

  return {
    enabled: () => saved.enabled,

    setEnabled(enabled: boolean): void {
      if (saved.enabled === enabled) return;
      saved.enabled = enabled;
      save();
    },

    // Asks GitHub unless turned off or asked in the last day, even if that
    // failed. Resolves to the newer release, or undefined. A failure is
    // logged and keeps the release found before.
    async run(): Promise<UpdateAvailable | undefined> {
      if (!saved.enabled) return undefined;
      const { checkedAt } = saved;
      if (checkedAt !== undefined && now() - checkedAt < CHECK_INTERVAL_MS) return newer();
      saved.checkedAt = now();
      try {
        const latest = await fetchLatest();
        if (latest) saved.latest = latest;
        else delete saved.latest;
      } catch (error) {
        log(`Update check failed: ${message(error)}`);
      }
      save();
      return newer();
    },
  };
}

// Whether `url` is a release page of this project, the only pages the app
// opens in the browser.
export function isReleasePageUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !URL.canParse(url)) return false;
  const parsed = new URL(url);
  return (
    parsed.protocol === 'https:' &&
    parsed.host === 'github.com' &&
    parsed.username === '' &&
    parsed.password === '' &&
    parsed.pathname.startsWith(RELEASES_PATH) &&
    parsed.pathname.length > RELEASES_PATH.length
  );
}

// The release's version and page, or undefined for a prerelease. Throws when
// malformed.
function parseRelease(json: unknown): UpdateAvailable | undefined {
  const {
    tag_name: tag,
    html_url: url,
    prerelease,
  } = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
  const version = typeof tag === 'string' ? VERSION_TAG.exec(tag)?.[1] : undefined;
  if (version === undefined || !isReleasePageUrl(url)) {
    throw new Error('unexpected response');
  }
  if (prerelease === true || version.includes('-')) return undefined;
  return { version, url };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Whether `version` is above `current`, by `X.Y.Z`. A prerelease suffix on
// `current` is ignored.
function isNewer(version: string, current: string): boolean {
  const parts = (v: string) => (v.split('-')[0] ?? '').split('.').map(Number);
  const a = parts(version);
  const b = parts(current);
  for (let i = 0; i < 3; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

function read(storage: UpdateCheckStorage): Saved {
  try {
    const json = JSON.parse(storage.read() ?? '{}') as Partial<Saved> | null;
    const saved: Saved = { enabled: json?.enabled !== false };
    if (typeof json?.checkedAt === 'number') saved.checkedAt = json.checkedAt;
    const latest = json?.latest;
    if (typeof latest?.version === 'string' && isReleasePageUrl(latest.url)) {
      saved.latest = { version: latest.version, url: latest.url };
    }
    return saved;
  } catch {
    return { enabled: true };
  }
}
