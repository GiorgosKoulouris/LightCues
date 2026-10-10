// Builds the app from a pinned ref, inventories what ships and runs the
// scanners on it, checks the Electron runtime against the releases feed, and
// matches the findings against security/accepted.yml (ADR 0009). Writes raw
// outputs to reports/security/<date>-<shortsha>[-dirty]/. The matching is by
// id and package or file only. Does no triage.
// Usage: npm run security:scan -- [--ref <ref> | --release vX.Y.Z | --working-tree]
//        [--electronegativity] [--keep-worktree]
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ACCEPTED_FILE, matchAccepted, parseAccepted } from './security-scan/accepted.mjs';
import { checkElectron, RELEASES_URL, releaseNotesUrl } from './security-scan/electron.mjs';
import { normalizeFindings, shippedLicenses } from './security-scan/findings.mjs';
import { buildInventory, extractApp } from './security-scan/inventory.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEMGREP_PACKS = ['p/javascript', 'p/typescript', 'p/react', 'p/secrets'];
const SEMGREP_RULES_DIR = join(repoRoot, 'security/semgrep');
// Not in the devcontainer: npx fetches it, so it is pinned here.
const ELECTRONEGATIVITY_VERSION = '1.10.3';
const FETCH_TIMEOUT_MS = 30_000;

class ScanError extends Error {}

async function main() {
  const options = readOptions();
  const tools = checkTools();
  const acceptedEntries = readAcceptedEntries();
  const sha = resolveCommit(options.ref);
  const dirty = options.workingTree && git('status', '--porcelain') !== '';

  const tmp = mkdtempSync(join(tmpdir(), 'lightcues-scan-'));
  const buildDir = join(tmp, 'build');
  const appDir = join(tmp, 'app');
  let cleanedUp = false;
  const cleanUp = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (options.keepWorktree) {
      const removeWorktree = options.workingTree
        ? ''
        : `git worktree remove --force ${buildDir} && `;
      console.log(`Kept the build in ${tmp}. Remove it with: ${removeWorktree}rm -rf ${tmp}`);
      return;
    }
    // Best effort, so a failed `worktree add` doesn't hide the original error.
    if (!options.workingTree) {
      spawnSync('git', ['worktree', 'remove', '--force', buildDir], { cwd: repoRoot });
      spawnSync('git', ['worktree', 'prune'], { cwd: repoRoot });
    }
    rmSync(tmp, { recursive: true, force: true });
  };
  process.on('SIGINT', () => {
    cleanUp();
    process.exit(130);
  });

  try {
    if (options.workingTree) copyWorkingTree(buildDir);
    else git('worktree', 'add', '--detach', buildDir, sha);
    build(buildDir);
    extractApp(join(buildDir, 'dist/win-unpacked/resources'), appDir);

    const lockfileText = readFileSync(join(buildDir, 'package-lock.json'), 'utf8');
    const inventory = buildInventory(appDir, JSON.parse(lockfileText));
    const meta = {
      ref: options.ref,
      sha,
      workingTree: options.workingTree,
      dirty,
      lockfileSha256: createHash('sha256').update(lockfileText).digest('hex'),
      versions: {
        node: process.versions.node,
        npm: execFileSync('npm', ['--version'], { cwd: buildDir, encoding: 'utf8' }).trim(),
        ...tools,
        ...(options.electronegativity && { electronegativity: ELECTRONEGATIVITY_VERSION }),
      },
      date: new Date().toISOString(),
    };

    const outDir = join(
      repoRoot,
      'reports/security',
      `${meta.date.slice(0, 10)}-${sha.slice(0, 7)}${dirty ? '-dirty' : ''}`,
    );
    // Written aside and moved in at the end: a failed scan leaves no
    // half-written dir that could pass for a report, and keeps an earlier one.
    const partialDir = `${outDir}.partial`;
    rmSync(partialDir, { recursive: true, force: true });
    mkdirSync(partialDir, { recursive: true });
    let findings, electron, acceptance;
    try {
      writeJson(join(partialDir, 'meta.json'), meta);
      writeJson(join(partialDir, 'inventory.json'), inventory);
      findings = scan(buildDir, appDir, join(partialDir, 'raw'), inventory, options);
      electron = await runElectronCheck(join(partialDir, 'raw/electron.json'), inventory);
      // The UTC date, as in the report dir name.
      acceptance = matchAccepted(findings, acceptedEntries, meta.date.slice(0, 10));
      writeJson(join(partialDir, 'raw/accepted.json'), acceptance);
    } catch (error) {
      rmSync(partialDir, { recursive: true, force: true });
      throw error;
    }
    rmSync(outDir, { recursive: true, force: true });
    renameSync(partialDir, outDir);
    console.log(
      `${inventory.ships.length} shipped, ${inventory.devOnly.length} dev-only, ` +
        `${findings.length} findings, ${acceptanceSummary(acceptance)}, ` +
        `Electron ${electronSummary(electron)}. Wrote ${outDir}`,
    );
  } finally {
    cleanUp();
  }
}

function readOptions() {
  const { values } = parseArgs({
    options: {
      ref: { type: 'string' },
      release: { type: 'string' },
      'working-tree': { type: 'boolean', default: false },
      electronegativity: { type: 'boolean', default: false },
      'keep-worktree': { type: 'boolean', default: false },
    },
  });
  const targetCount =
    Number(values.ref !== undefined) +
    Number(values.release !== undefined) +
    Number(values['working-tree']);
  if (targetCount > 1) {
    throw new ScanError('Pass only one of --ref, --release and --working-tree.');
  }
  let ref = values.ref ?? 'HEAD';
  if (values.release !== undefined) {
    if (!/^v\d+\.\d+\.\d+$/.test(values.release)) {
      throw new ScanError(`--release takes a version tag like v1.2.3, not "${values.release}".`);
    }
    ref = `refs/tags/${values.release}`;
  }
  return {
    ref,
    workingTree: values['working-tree'],
    electronegativity: values.electronegativity,
    keepWorktree: values['keep-worktree'],
  };
}

// The pinned versions live only in the main checkout's Dockerfile ARGs, which
// match the installed tools. An old --ref may pin other versions or none.
function checkTools() {
  const dockerfile = readFileSync(join(repoRoot, '.devcontainer/Dockerfile'), 'utf8');
  const pinned = (name) => dockerfile.match(new RegExp(`^ARG ${name}=(.+)$`, 'm'))?.[1].trim();
  const tools = {
    osvScanner: { pin: pinned('OSV_SCANNER_VERSION'), command: 'osv-scanner' },
    semgrep: { pin: pinned('SEMGREP_VERSION'), command: 'semgrep' },
  };
  const versions = {};
  for (const [key, { pin, command }] of Object.entries(tools)) {
    const output = spawnSync(command, ['--version'], { encoding: 'utf8' });
    // osv-scanner prints "osv-scanner version: X" first, semgrep just "X".
    const version = output.stdout?.match(/(\d+\.\d+\.\d+)/)?.[1];
    if (!pin || version !== pin) {
      throw new ScanError(
        `${command} ${version ?? 'is missing'}, expected ${pin}. Rebuild the devcontainer.`,
      );
    }
    versions[key] = version;
  }
  return versions;
}

// Read from the main checkout, like the semgrep rules: the current acceptances
// apply to any ref. Read before the build, so a malformed entry fails fast.
function readAcceptedEntries() {
  const file = join(repoRoot, ACCEPTED_FILE);
  if (!existsSync(file)) return [];
  try {
    return parseAccepted(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new ScanError(error.message);
  }
}

// Tracked and untracked files as they are on disk, without ignored ones
// (node_modules, out, dist, reports).
function copyWorkingTree(buildDir) {
  const files = git('ls-files', '-z', '--cached', '--others', '--exclude-standard');
  for (const file of files.split('\0').filter(Boolean)) {
    const source = join(repoRoot, file);
    if (!existsSync(source)) continue; // Deleted but still tracked.
    mkdirSync(dirname(join(buildDir, file)), { recursive: true });
    cpSync(source, join(buildDir, file));
  }
}

// Same steps as release.yml, but unpacked only: --dir skips NSIS and the app
// contents are the installer's.
function build(buildDir) {
  // The Linux Electron binary is never run. electron-builder fetches the Windows one.
  // The notices hook would fail the build on a license the scan should report.
  const env = { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD: '1', LIGHTCUES_SKIP_NOTICES: '1' };
  run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: buildDir, env });
  run('npx', ['--no-install', 'electron-vite', 'build'], { cwd: buildDir, env });
  run('npx', ['--no-install', 'electron-builder', '--win', '--dir', '--publish', 'never'], {
    cwd: buildDir,
    env,
  });
}

// Runs the scanners and writes their raw outputs to rawDir, plus the
// normalized findings.json and licenses.json that triage reads.
function scan(buildDir, appDir, rawDir, inventory, { electronegativity }) {
  mkdirSync(rawDir, { recursive: true });
  const raw = (name) => join(rawDir, `${name}.json`);
  const osvLockfile = runOsv(raw('osv-lockfile'), [
    '--lockfile',
    join(buildDir, 'package-lock.json'),
  ]);
  // The app has no lockfile. The packagejson plugin reads each installed
  // package's package.json.
  const osvApp = runOsv(raw('osv-app'), [
    '--experimental-plugins',
    'javascript/packagejson',
    '-r',
    appDir,
  ]);
  const outputs = {
    osvLockfile,
    osvApp,
    semgrep: runSemgrep(buildDir, raw('semgrep')),
    electronegativity: electronegativity
      ? runElectronegativity(buildDir, raw('electronegativity'), inventory)
      : undefined,
  };

  const findings = normalizeFindings(outputs, inventory, { semgrepRulesDir: SEMGREP_RULES_DIR });
  writeJson(raw('findings'), findings);
  writeJson(raw('licenses'), shippedLicenses(inventory, { osvApp, osvLockfile }));
  return findings;
}

// Exit 1 means vulnerabilities found. `--all-packages --licenses` lists every
// package with its licenses, for licenses.json.
function runOsv(output, args) {
  run(
    'osv-scanner',
    [
      'scan',
      'source',
      '--all-packages',
      '--licenses',
      '--verbosity',
      'warn',
      '--format',
      'json',
      '--output-file',
      output,
      ...args,
    ],
    { okStatuses: [0, 1] },
  );
  return readJson(output);
}

// The rules come from the main checkout, like the tool pins: the current rules
// apply to any ref. Without --error, findings exit 0, and a rule or file that
// failed shows only in `errors`.
function runSemgrep(buildDir, output) {
  const configs = [...SEMGREP_PACKS, ...(existsSync(SEMGREP_RULES_DIR) ? [SEMGREP_RULES_DIR] : [])];
  run(
    'semgrep',
    [
      'scan',
      '--metrics=off',
      ...configs.flatMap((c) => ['--config', c]),
      '--json',
      '--output',
      output,
      'src/',
    ],
    { cwd: buildDir },
  );
  const result = readJson(output);
  const errors = result.errors.filter((e) => e.level === 'error');
  if (errors.length > 0) {
    throw new ScanError(`semgrep failed: ${errors.map((e) => e.message).join(' ')}`);
  }
  return result;
}

// It writes only CSV or SARIF, so the .json holds SARIF. It needs the Electron
// version to judge defaults.
function runElectronegativity(buildDir, output, inventory) {
  const electron = inventory.ships.find((p) => p.name === 'electron');
  const sarif = output.replace(/\.json$/, '.sarif');
  run(
    'npx',
    [
      '--yes',
      `@doyensec/electronegativity@${ELECTRONEGATIVITY_VERSION}`,
      '--input',
      'src',
      '--relative',
      '--verbose',
      'false',
      ...(electron ? ['--electron-version', electron.version] : []),
      '--output',
      sarif,
    ],
    { cwd: buildDir },
  );
  renameSync(sarif, output);
  return readJson(output);
}

// A feed that can't be fetched is recorded in electron.json, not a failure.
async function runElectronCheck(output, inventory) {
  const installed = inventory.ships.find((p) => p.name === 'electron')?.version ?? null;
  const result = await checkElectron(installed, {
    fetchReleases: () => fetchJson(RELEASES_URL),
    fetchNotes: async (version) => (await fetchJson(releaseNotesUrl(version))).body ?? '',
  });
  writeJson(output, result);
  return result;
}

function acceptanceSummary({ matched, expired, unused }) {
  return `${matched.length} accepted, ${expired.length} expired and ${unused.length} unused acceptances`;
}

function electronSummary({ installed, error, supported, upToDate, latestPatch }) {
  if (error) return `check skipped (${error})`;
  const support = supported ? 'supported' : 'unsupported major';
  return `${installed} ${support}, ${upToDate ? 'up to date' : `latest ${latestPatch}`}`;
}

// Node reports network errors as "fetch failed", with the reason in `cause`.
async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': 'lightcues-security-scan' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`GET ${url}: ${error.cause?.message ?? error.message}`, { cause: error });
  }
  if (!response.ok) throw new Error(`GET ${url}: HTTP ${response.status}`);
  return response.json();
}

function resolveCommit(ref) {
  try {
    return git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
  } catch {
    throw new ScanError(`No commit for ${ref.replace(/^refs\/tags\//, 'tag ')}.`);
  }
}

function git(...args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new ScanError(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

// A status in okStatuses only means "findings found". Anything else, or no
// status (killed or not found), is a tool failure.
function run(command, args, { cwd, env, okStatuses = [0] } = {}) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (!okStatuses.includes(result.status)) {
    const how = result.error?.message ?? `exit ${result.status ?? result.signal}`;
    throw new ScanError(`${command} ${args.join(' ')} failed (${how}). See its output above.`);
  }
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

try {
  await main();
} catch (error) {
  if (!(error instanceof ScanError)) throw error;
  console.error(error.message);
  process.exit(1);
}
