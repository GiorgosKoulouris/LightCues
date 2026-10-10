import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BUNDLED_PACKAGES_FILE, bundledPackages, packageOf } from './bundled-packages.mjs';

describe('packageOf', () => {
  it('finds the package of a file in node_modules', () => {
    expect(packageOf('/repo/node_modules/react/cjs/react.production.js')).toEqual({
      path: 'node_modules/react',
      dir: '/repo/node_modules/react',
    });
  });

  it('keeps the scope and the nesting', () => {
    expect(packageOf('/repo/node_modules/@radix-ui/react-dialog/dist/index.mjs').path).toBe(
      'node_modules/@radix-ui/react-dialog',
    );
    expect(packageOf('/repo/node_modules/a/node_modules/@b/c/index.js').path).toBe(
      'node_modules/a/node_modules/@b/c',
    );
  });

  it('reads virtual ids and Windows paths', () => {
    expect(packageOf('\0/repo/node_modules/react/index.js?commonjs-module').path).toBe(
      'node_modules/react',
    );
    expect(packageOf('C:\\repo\\node_modules\\react\\index.js')).toEqual({
      path: 'node_modules/react',
      dir: 'C:/repo/node_modules/react',
    });
  });

  it('skips the app’s own and virtual modules', () => {
    expect(packageOf('/repo/src/renderer/src/App.tsx')).toBeNull();
    expect(packageOf('\0commonjsHelpers.js')).toBeNull();
  });
});

describe('bundledPackages', () => {
  let root;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'bundled-test-'));
    for (const [path, manifest] of Object.entries({
      'node_modules/react': { name: 'react', version: '19.3.0' },
      'node_modules/lucide-react': { name: 'lucide-react', version: '1.52.0' },
    })) {
      mkdirSync(join(root, path), { recursive: true });
      writeFileSync(join(root, path, 'package.json'), JSON.stringify(manifest));
    }
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('writes the packages of every chunk once, by path', () => {
    const emitted = [];
    const bundle = {
      'index.js': {
        type: 'chunk',
        modules: {
          [`${root}/src/App.tsx`]: {},
          [`${root}/node_modules/react/index.js`]: {},
          [`${root}/node_modules/react/cjs/react.production.js`]: {},
        },
      },
      'icons.js': { type: 'chunk', modules: { [`${root}/node_modules/lucide-react/x.js`]: {} } },
      'index.css': { type: 'asset' },
    };

    bundledPackages().generateBundle.call({ emitFile: (f) => emitted.push(f) }, {}, bundle);

    expect(emitted).toHaveLength(1);
    expect(emitted[0].fileName).toBe(BUNDLED_PACKAGES_FILE);
    expect(JSON.parse(emitted[0].source)).toEqual([
      { name: 'lucide-react', version: '1.52.0', path: 'node_modules/lucide-react' },
      { name: 'react', version: '19.3.0', path: 'node_modules/react' },
    ]);
  });
});
