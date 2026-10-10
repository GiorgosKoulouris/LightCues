import { nameAtVersion } from './inventory.mjs';
import { isAllowedLicense } from './licenses.mjs';

// One list of findings from the raw tool outputs (ADR 0009). It is the input
// for triage and for the "new since last report" diff. Tool severity is kept
// unchanged. `scope` is ships or dev-only: from the inventory for packages,
// from the file for code (test files don't ship).
//
// A finding: { id, aliases, tool, package, path, line, severity, cvss, title,
// scope }. A package finding has `package: 'name@version'`, a code finding
// `path` and `line`. The unused ones are null. Global Electronegativity checks
// have no file, so `path: null` too.
//
// semgrep prefixes the ids of rules from a local dir with that dir's path
// (`/workspaces/security/semgrep` gives `workspaces.security.semgrep.`). With
// `semgrepRulesDir`, the prefix is dropped, so ids don't depend on where the
// repo is checked out.
export function normalizeFindings(
  { osvLockfile, osvApp, semgrep, electronegativity },
  inventory,
  { semgrepRulesDir } = {},
) {
  const shipped = new Set(inventory.ships.map(nameAtVersion));
  const byKey = new Map();
  for (const finding of [
    ...osvFindings(osvLockfile, shipped),
    ...osvFindings(osvApp, shipped),
    ...semgrepFindings(semgrep, semgrepRulesDir),
    ...electronegativityFindings(electronegativity),
  ]) {
    const key = [finding.tool, finding.id, finding.package, finding.path, finding.line].join(' ');
    if (!byKey.has(key)) byKey.set(key, finding);
  }
  return [...byKey.values()].sort(byToolIdAndLocation);
}

// The licenses osv-scanner found for each shipped package. The app scan wins.
// The lockfile scan adds Electron and the bundled packages, which are not in
// the app's node_modules. `allowed`: every license is on the allow list.
export function shippedLicenses(inventory, { osvApp, osvLockfile }) {
  const licenses = new Map();
  for (const output of [osvApp, osvLockfile]) {
    for (const { package: pkg, licenses: found } of osvPackages(output)) {
      const key = nameAtVersion(pkg);
      if (found && !licenses.has(key)) licenses.set(key, found);
    }
  }
  return inventory.ships.map((p) => {
    const found = licenses.get(nameAtVersion(p)) ?? null;
    return { ...p, licenses: found, allowed: found !== null && found.every(isAllowedLicense) };
  });
}

// osv-scanner groups an advisory with its aliases (GHSA, CVE) per package.
function osvFindings(output, shipped) {
  const findings = [];
  for (const { package: pkg, groups = [], vulnerabilities = [] } of osvPackages(output)) {
    for (const group of groups) {
      const [id, ...otherIds] = group.ids;
      const vulns = vulnerabilities.filter((v) => group.ids.includes(v.id));
      findings.push({
        id,
        aliases: [...new Set([...otherIds, ...group.aliases])].filter((a) => a !== id).sort(),
        tool: 'osv-scanner',
        package: nameAtVersion(pkg),
        path: null,
        line: null,
        severity:
          vulns.find((v) => v.database_specific?.severity)?.database_specific.severity ?? null,
        cvss: group.max_severity || null,
        title: vulns.find((v) => v.summary)?.summary ?? null,
        scope: shipped.has(nameAtVersion(pkg)) ? 'ships' : 'dev-only',
      });
    }
  }
  return findings;
}

function osvPackages(output) {
  return output?.results.flatMap((r) => r.packages) ?? [];
}

function semgrepFindings(output, rulesDir) {
  const prefix = rulesDir && `${rulesDir.replace(/^\/+/, '').replaceAll('/', '.')}.`;
  return (output?.results ?? []).map((r) => ({
    id: prefix && r.check_id.startsWith(prefix) ? r.check_id.slice(prefix.length) : r.check_id,
    aliases: [],
    tool: 'semgrep',
    package: null,
    path: r.path,
    line: r.start.line,
    severity: r.extra.severity,
    cvss: null,
    title: r.extra.message,
    scope: codeScope(r.path),
  }));
}

// SARIF. Paths are relative to the scanned `src/`. Global checks point at
// `file:///`.
function electronegativityFindings(output) {
  return (output?.runs ?? []).flatMap((run) =>
    run.results.map((r) => {
      const location = r.locations?.[0]?.physicalLocation;
      const uri = location?.artifactLocation.uri;
      const path = uri && !uri.startsWith('file:') ? `src/${uri}` : null;
      return {
        id: r.ruleId,
        aliases: [],
        tool: 'electronegativity',
        package: null,
        path,
        line: path ? location.region.startLine : null,
        severity: r.level,
        cvss: null,
        title: r.message.text,
        scope: path ? codeScope(path) : 'ships',
      };
    }),
  );
}

function codeScope(path) {
  return /\.test\.[cm]?[jt]sx?$/.test(path) ? 'dev-only' : 'ships';
}

// Stable order, so two reports diff cleanly: tool, id, then where. Strings
// compare by code point, as in the inventory. Line numbers are padded so they
// sort as numbers.
function byToolIdAndLocation(a, b) {
  const keys = (f) => [f.tool, f.id, f.package ?? f.path ?? '', String(f.line ?? '').padStart(6)];
  const [ka, kb] = [keys(a), keys(b)];
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
  }
  return 0;
}
