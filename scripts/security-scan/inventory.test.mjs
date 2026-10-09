import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildInventory } from './inventory.mjs';

// An extracted app: one package.json per installed package, by path.
function writeApp(appDir, packages) {
  for (const [path, manifest] of Object.entries(packages)) {
    const file = join(appDir, path, 'package.json');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(manifest));
  }
}

describe('buildInventory', () => {
  let appDir;
  beforeEach(() => {
    appDir = mkdtempSync(join(tmpdir(), 'inventory-test-'));
  });
  afterEach(() => {
    rmSync(appDir, { recursive: true, force: true });
  });

  it('lists the packages installed in the app as shipped', () => {
    writeApp(appDir, {
      '': { name: 'lightcues', version: '0.1.1' },
      'node_modules/fflate': { name: 'fflate', version: '0.8.3' },
      'node_modules/@serialport/stream': { name: '@serialport/stream', version: '13.0.0' },
    });

    const { ships } = buildInventory(appDir, { packages: {} });

    expect(ships).toEqual([
      { name: '@serialport/stream', version: '13.0.0', path: 'node_modules/@serialport/stream' },
      { name: 'fflate', version: '0.8.3', path: 'node_modules/fflate' },
    ]);
  });

  it('lists nested copies of a package by their own path', () => {
    writeApp(appDir, {
      'node_modules/debug': { name: 'debug', version: '4.4.3' },
      'node_modules/serialport': { name: 'serialport', version: '13.0.0' },
      'node_modules/serialport/node_modules/debug': { name: 'debug', version: '4.3.4' },
      // A package.json inside a package is not a package.
      'node_modules/serialport/dist/esm': { type: 'module' },
    });

    const { ships } = buildInventory(appDir, { packages: {} });

    expect(ships).toEqual([
      { name: 'debug', version: '4.4.3', path: 'node_modules/debug' },
      { name: 'serialport', version: '13.0.0', path: 'node_modules/serialport' },
      { name: 'debug', version: '4.3.4', path: 'node_modules/serialport/node_modules/debug' },
    ]);
  });

  it('splits by what the build contains, not by the dev flag', () => {
    writeApp(appDir, {
      'node_modules/fflate': { name: 'fflate', version: '0.8.3' },
      'node_modules/tslib': { name: 'tslib', version: '2.8.1' },
    });
    const lockfile = {
      packages: {
        '': { name: 'lightcues', version: '0.1.1' },
        'node_modules/fflate': { version: '0.8.3' },
        // A devDependency that the build still ships.
        'node_modules/tslib': { version: '2.8.1', dev: true },
        // A dependency that the build leaves out.
        'node_modules/@julusian/midi/node_modules/node-addon-api': { version: '8.5.0' },
        'node_modules/vitest': { version: '5.0.3', dev: true },
      },
    };

    const { ships, devOnly } = buildInventory(appDir, lockfile);

    expect(ships.map((p) => p.path)).toEqual(['node_modules/fflate', 'node_modules/tslib']);
    expect(devOnly).toEqual([
      {
        name: 'node-addon-api',
        version: '8.5.0',
        path: 'node_modules/@julusian/midi/node_modules/node-addon-api',
      },
      { name: 'vitest', version: '5.0.3', path: 'node_modules/vitest' },
    ]);
  });

  it('matches by name and version, as the build re-hoists packages', () => {
    writeApp(appDir, {
      'node_modules/serialport': { name: 'serialport', version: '13.0.0' },
      'node_modules/debug': { name: 'debug', version: '4.4.0' },
    });
    const lockfile = {
      packages: {
        'node_modules/serialport': { version: '13.0.0' },
        'node_modules/serialport/node_modules/debug': { version: '4.4.0' },
        'node_modules/debug': { version: '4.4.3', dev: true },
      },
    };

    const { ships, devOnly } = buildInventory(appDir, lockfile);

    expect(ships).toEqual([
      { name: 'debug', version: '4.4.0', path: 'node_modules/debug' },
      { name: 'serialport', version: '13.0.0', path: 'node_modules/serialport' },
    ]);
    expect(devOnly).toEqual([{ name: 'debug', version: '4.4.3', path: 'node_modules/debug' }]);
  });

  it('counts the Electron runtime as shipped', () => {
    writeApp(appDir, { 'node_modules/fflate': { name: 'fflate', version: '0.8.3' } });
    const lockfile = {
      packages: {
        'node_modules/electron': { version: '44.6.0', dev: true },
        'node_modules/fflate': { version: '0.8.3' },
      },
    };

    const { ships, devOnly } = buildInventory(appDir, lockfile);

    expect(ships).toEqual([
      { name: 'electron', version: '44.6.0', path: 'node_modules/electron' },
      { name: 'fflate', version: '0.8.3', path: 'node_modules/fflate' },
    ]);
    expect(devOnly).toEqual([]);
  });
});
