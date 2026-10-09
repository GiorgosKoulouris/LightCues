// js-yaml is not a direct dependency. It comes with electron-builder, like
// @electron/asar.
import yaml from 'js-yaml';

// Accepted risks. security/accepted.yml lists findings the
// maintainer accepted, each with a reason and a review-by date. Matching
// findings are still reported, under "Accepted risks". Past review-by they
// count as findings again.
//
// An entry: { id, package | path, reason, accepted, reviewBy }. `package` is
// name@version, as in findings.json. `path` is a repo-relative file and matches
// any line in it. Dates are YYYY-MM-DD.

export const ACCEPTED_FILE = 'security/accepted.yml';
const REQUIRED = ['id', 'reason', 'accepted', 'reviewBy'];
const KNOWN = new Set([...REQUIRED, 'package', 'path']);

// Throws on the first malformed entry, with its 1-based index.
export function parseAccepted(text) {
  let entries;
  try {
    // The JSON schema keeps dates as strings, not Date objects.
    entries = yaml.load(text, { schema: yaml.JSON_SCHEMA }) ?? [];
  } catch (error) {
    throw new Error(`${ACCEPTED_FILE} is not valid YAML: ${error.message}`, { cause: error });
  }
  if (!Array.isArray(entries)) throw new Error(`${ACCEPTED_FILE} must be a list of entries`);
  entries.forEach((entry, i) => {
    const problem = entryProblem(entry);
    if (problem) throw new Error(`${ACCEPTED_FILE} entry ${i + 1}: ${problem}`);
  });
  return entries;
}

// Splits the entries into matched, expired and unused. Each entry gets the
// findings it matches. An entry id matches a finding id or any of its aliases
// (CVE, GHSA). An entry past reviewBy on `today` is expired even when it
// matches nothing, so its `findings` can be empty.
export function matchAccepted(findings, entries, today) {
  const result = { matched: [], expired: [], unused: [] };
  for (const entry of entries) {
    const matching = findings.filter((f) => matches(entry, f));
    result[outcome(entry, matching, today)].push({ ...entry, findings: matching });
  }
  return result;
}

function outcome(entry, matching, today) {
  if (entry.reviewBy < today) return 'expired';
  if (matching.length > 0) return 'matched';
  return 'unused';
}

function matches(entry, finding) {
  if (entry.id !== finding.id && !finding.aliases.includes(entry.id)) return false;
  return entry.package !== undefined
    ? entry.package === finding.package
    : entry.path === finding.path;
}

function entryProblem(entry) {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return 'must be a mapping';
  }
  const unknown = Object.keys(entry).find((k) => !KNOWN.has(k));
  if (unknown) return `unknown field ${unknown}`;
  const missing = REQUIRED.find((k) => !nonEmptyString(entry[k]));
  if (missing) return `missing ${missing}`;
  const hasPackage = entry.package !== undefined;
  const hasPath = entry.path !== undefined;
  if (hasPackage === hasPath) {
    return hasPackage ? 'needs package or path, not both' : 'needs package or path';
  }
  if (hasPackage && !/^(@[^/@]+\/)?[^/@]+@[^@]+$/.test(entry.package)) {
    return 'package must be name@version';
  }
  if (hasPath && !nonEmptyString(entry.path)) return 'path must be a file';
  for (const key of ['accepted', 'reviewBy']) {
    if (!isDate(entry[key])) return `${key} ${entry[key]} is not a YYYY-MM-DD date`;
  }
  if (entry.reviewBy < entry.accepted) return 'reviewBy is before accepted';
  return null;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

// Rejects impossible days like 2027-02-30, which Date rolls over.
function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
