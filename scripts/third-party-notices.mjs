// Writes THIRD_PARTY_NOTICES.txt into the packed app's resources: the name,
// version, license and license files of every npm package that ships, plus
// the Open Fixture Library credit for the examples. "What ships" is the
// security scan's inventory of the packed app. Fails the build if a package
// has no license file or a license off the allow list.
// electron-builder runs it as the afterPack hook (electron-builder.yml),
// before the installer is built.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildInventory,
  compareCodePoints as compare,
  extractApp,
  nameAtVersion,
} from './security-scan/inventory.mjs';
import { isAllowedLicense } from './security-scan/licenses.mjs';

export const NOTICES_FILE = 'THIRD_PARTY_NOTICES.txt';
export const SKIP_ENV = 'LIGHTCUES_SKIP_NOTICES';
// Copies of upstream license files for packages that ship none, as
// `<name>@<version>.txt`. The version is in the name so an update is checked again.
export const FALLBACK_LICENSES_DIR = 'build/licenses';
const EXAMPLES_README = 'examples/README.md';
const LICENSE_FILE = /^(licen[cs]e|copying|notice)([-._].*)?$/i;
const RULE = '='.repeat(80);

export class NoticesError extends Error {}

export default async function afterPack({ appOutDir, packager }) {
  // The security scan reports licenses instead of failing on them (ADR 0009).
  if (process.env[SKIP_ENV] === '1') return;
  const projectDir = packager.projectDir;
  const resourcesDir = join(appOutDir, 'resources');
  const appDir = mkdtempSync(join(tmpdir(), 'lightcues-notices-'));
  try {
    extractApp(resourcesDir, appDir);
    const lockfile = JSON.parse(readFileSync(join(projectDir, 'package-lock.json'), 'utf8'));
    const inventory = buildInventory(appDir, lockfile);
    writeFileSync(
      join(resourcesDir, NOTICES_FILE),
      buildNotices({ appDir, projectDir, inventory }),
    );
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
}

// A bundled package is read from the project's node_modules, the others from
// the app. Electron is left out: it ships LICENSE.electron.txt and
// LICENSES.chromium.html itself.
export function buildNotices({ appDir, projectDir, inventory }) {
  const problems = [];
  const sections = [];
  const seen = new Set();
  const packages = inventory.ships
    .filter((p) => p.name !== 'electron')
    .sort((a, b) => compare(a.name, b.name) || compare(a.version, b.version));
  for (const p of packages) {
    if (seen.has(nameAtVersion(p))) continue;
    seen.add(nameAtVersion(p));
    const dir = join(p.bundled ? projectDir : appDir, p.path);
    const license = licenseOf(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')));
    if (!license || !isAllowedLicense(license)) {
      problems.push(`${nameAtVersion(p)}: license ${license ?? 'missing'} is not allowed`);
    }
    const texts = licenseTexts(
      dir,
      join(projectDir, FALLBACK_LICENSES_DIR, `${nameAtVersion(p)}.txt`),
    );
    if (texts.length === 0) {
      problems.push(
        `${nameAtVersion(p)}: no license file. Add the upstream one as ` +
          `${FALLBACK_LICENSES_DIR}/${nameAtVersion(p)}.txt`,
      );
    }
    sections.push(section(`${p.name} ${p.version}`, license, texts));
  }
  if (problems.length > 0) {
    throw new NoticesError(`Third-party notices:\n  ${problems.join('\n  ')}`);
  }
  return [header(), ...sections, fixtureDataSection(projectDir)].join('\n\n');
}

// `license` is an SPDX expression. Old packages use `{ type }` or `licenses`.
function licenseOf(manifest) {
  if (typeof manifest.license === 'string') return manifest.license;
  if (manifest.license?.type) return manifest.license.type;
  const types = (manifest.licenses ?? []).map((l) => l.type).filter(Boolean);
  if (types.length === 0) return null;
  return types.length === 1 ? types[0] : `(${types.join(' OR ')})`;
}

function licenseTexts(dir, fallback) {
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && LICENSE_FILE.test(entry.name))
    .map((entry) => entry.name)
    .sort(compare);
  if (files.length > 0) {
    return files.map((file) => ({ file, text: readFileSync(join(dir, file), 'utf8') }));
  }
  if (existsSync(fallback)) {
    return [{ file: 'LICENSE (upstream copy)', text: readFileSync(fallback, 'utf8') }];
  }
  return [];
}

function header() {
  return [
    'LightCues third-party notices',
    '',
    'LightCues is licensed under GPL-3.0-only (LICENSE.txt). It includes the',
    'third-party software below, each under its own license. The notices of the',
    'Electron runtime are in LICENSE.electron.txt and LICENSES.chromium.html,',
    'next to LightCues.exe.',
  ].join('\n');
}

function section(title, license, texts) {
  const body = texts.map(({ file, text }) => `--- ${file} ---\n\n${text.trim()}`);
  return [RULE, title, `License: ${license}`, '', ...body].join('\n');
}

// The example Venue Patch embeds Profiles made from Open Fixture Library
// data. The license text is the code block in examples/README.md's
// "Fixture data" section.
function fixtureDataSection(projectDir) {
  const readme = readFileSync(join(projectDir, EXAMPLES_README), 'utf8');
  const text = readme
    .match(/^## Fixture data\n([\s\S]*?)(?=^## |(?![\s\S]))/m)?.[1]
    .match(/^```.*\n([\s\S]*?)^```/m)?.[1]
    .trim();
  if (!text) {
    throw new NoticesError(`${EXAMPLES_README} has no license block under "## Fixture data".`);
  }
  return [
    RULE,
    'Open Fixture Library fixture data',
    'License: MIT',
    '',
    'The example Venue Patch (examples/) holds Fixture Profiles made from Open',
    'Fixture Library (https://open-fixture-library.org/) fixture files.',
    '',
    text,
    '',
  ].join('\n');
}
