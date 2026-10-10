import asar from '@electron/asar';
import { cpSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUNDLED_PACKAGES_FILE } from '../bundled-packages.mjs';

const ELECTRON_PATH = 'node_modules/electron';

// Which lockfile packages ship, from what the built app actually contains
// (ADR 0009). `appDir` is the extracted app.asar merged with app.asar.unpacked.
// The Electron runtime ships too, though it is not in the app's node_modules,
// and so do the packages Vite bundled into out/ (scripts/bundled-packages.mjs).
// Those have their lockfile path and `bundled: true`. Matching is by name and
// version: electron-builder re-hoists the production tree, so a shipped
// package can sit at another path than in the lockfile.
export function buildInventory(appDir, lockfile) {
  const ships = installedPackages(appDir);
  const electron = lockfile.packages[ELECTRON_PATH];
  if (electron) ships.push({ name: 'electron', version: electron.version, path: ELECTRON_PATH });
  const shipped = new Set(ships.map(nameAtVersion));
  for (const p of readBundledPackages(appDir)) {
    if (shipped.has(nameAtVersion(p))) continue;
    shipped.add(nameAtVersion(p));
    ships.push({ ...p, bundled: true });
  }
  ships.sort(byPath);
  const devOnly = Object.entries(lockfile.packages)
    .filter(([path]) => path !== '')
    .map(([path, entry]) => ({
      name: entry.name ?? nameFromPath(path),
      version: entry.version,
      path,
    }))
    .filter((p) => !shipped.has(nameAtVersion(p)))
    .sort(byPath);
  return { ships, devOnly };
}

export function nameAtVersion(p) {
  return `${p.name}@${p.version}`;
}

// `node_modules/a/node_modules/@b/c` is `@b/c`.
function nameFromPath(path) {
  return path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
}

// The app as it ships: `resourcesDir/app.asar` merged with app.asar.unpacked,
// extracted to appDir.
export function extractApp(resourcesDir, appDir) {
  asar.extractAll(join(resourcesDir, 'app.asar'), appDir);
  const unpacked = join(resourcesDir, 'app.asar.unpacked');
  if (existsSync(unpacked)) cpSync(unpacked, appDir, { recursive: true, force: true });
}

// The lists that the main, preload and renderer bundles carry.
function readBundledPackages(appDir) {
  const outDir = join(appDir, 'out');
  if (!existsSync(outDir)) return [];
  return readdirSync(outDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(outDir, entry.name, BUNDLED_PACKAGES_FILE))
    .filter((file) => existsSync(file))
    .flatMap((file) => JSON.parse(readFileSync(file, 'utf8')));
}

// Every package in the app's node_modules, nested ones included.
function installedPackages(appDir) {
  const found = [];
  for (const path of packageDirs(appDir, 'node_modules')) {
    const manifest = JSON.parse(readFileSync(join(appDir, path, 'package.json'), 'utf8'));
    found.push({ name: manifest.name, version: manifest.version, path });
  }
  return found;
}

function packageDirs(appDir, dir) {
  if (!existsSync(join(appDir, dir))) return [];
  const dirs = [];
  for (const entry of readdirSync(join(appDir, dir), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.name.startsWith('@')) dirs.push(...packageDirs(appDir, path));
    else if (existsSync(join(appDir, path, 'package.json'))) {
      dirs.push(path, ...packageDirs(appDir, `${path}/node_modules`));
    }
  }
  return dirs;
}

// Code-point order: localeCompare ignores `@` and `/`.
export function compareCodePoints(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function byPath(a, b) {
  return compareCodePoints(a.path, b.path);
}
