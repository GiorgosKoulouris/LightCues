// Electron runtime check (ADR 0009). Chromium and Node CVEs in Electron rarely
// reach npm advisories, so the installed version is checked against the
// Electron releases feed. The feed has no release notes. Those come from the
// GitHub release of each newer patch.

export const RELEASES_URL = 'https://releases.electronjs.org/releases.json';
// The release's Markdown notes are in the `body` field.
export const releaseNotesUrl = (version) =>
  `https://api.github.com/repos/electron/electron/releases/tags/v${version}`;
// Electron supports the latest 3 stable majors.
const SUPPORTED_MAJORS = 3;
// Electron lists security fixes as "Security: backported fix for CVE-…" or
// "Backported fixes from upstream ANGLE, Chromium, …". A plain "security"
// match would also hit "security key" (WebAuthn) and "security-scoped" (macOS).
const SECURITY_NOTE =
  /\bCVE-\d{4}-\d+|\bsecurity\b(?!-|\s+keys?\b)|\bbackported fix.*\bChromium\b/i;

// The result for raw/electron.json. `fetchReleases()` returns the parsed feed,
// `fetchNotes(version)` the Markdown notes of one release. A failed feed fetch
// is recorded in `error` and the other fields are null, so the run continues
// and the report says the check was skipped. A failed notes fetch is recorded
// on its patch only.
export async function checkElectron(installed, { fetchReleases, fetchNotes }) {
  const installedParts = installed && parseStable(installed);
  const result = {
    source: RELEASES_URL,
    installed,
    major: installedParts?.[0] ?? null,
    supportedMajors: null,
    supported: null,
    latestPatch: null,
    upToDate: null,
    newerPatches: null,
    error: null,
  };
  if (!installed) return { ...result, error: 'Electron is not in the inventory.' };
  if (!installedParts) return { ...result, error: `${installed} is not a stable release.` };

  let releases;
  try {
    releases = await fetchReleases();
  } catch (error) {
    return { ...result, error: error.message };
  }

  const stable = releases
    .map((r) => ({ ...r, parts: parseStable(r.version) }))
    .filter((r) => r.parts)
    .sort((a, b) => compareParts(b.parts, a.parts));
  const supportedMajors = [...new Set(stable.map((r) => r.parts[0]))].slice(0, SUPPORTED_MAJORS);
  const sameMajor = stable.filter((r) => r.parts[0] === result.major);
  const newer = sameMajor.filter((r) => compareParts(r.parts, installedParts) > 0);
  return {
    ...result,
    supportedMajors,
    supported: supportedMajors.includes(result.major),
    latestPatch: sameMajor[0]?.version ?? null,
    upToDate: newer.length === 0,
    newerPatches: await Promise.all(newer.map((r) => withSecurityNotes(r, fetchNotes))),
  };
}

async function withSecurityNotes({ version, date, chrome }, fetchNotes) {
  const patch = { version, date, chrome };
  try {
    return { ...patch, securityNotes: securityNotes(await fetchNotes(version)), notesError: null };
  } catch (error) {
    return { ...patch, securityNotes: null, notesError: error.message };
  }
}

// The note bullets that mention a security fix, without the bullet and the
// "(Also in …)" backport links.
function securityNotes(markdown) {
  return markdown
    .split('\n')
    .map((line) => line.match(/^\s*[*-]\s+(.*)$/)?.[1])
    .filter((text) => text && SECURITY_NOTE.test(text))
    .map((text) => text.replace(/\s*<sup>.*<\/sup>\s*$/, '').trim());
}

// [major, minor, patch] of a stable version. Null for nightlies, alphas and
// betas.
function parseStable(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

function compareParts(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}
