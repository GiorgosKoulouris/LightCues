import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Written next to each bundle, so the packed app lists the npm packages Vite
// compiled into it (React and others in the renderer). They are not in the
// app's node_modules. scripts/security-scan/inventory.mjs reads it.
export const BUNDLED_PACKAGES_FILE = 'bundled-packages.json';

// `{ name, version, path }` per package in the bundle. `path` is the package's
// lockfile path, like `node_modules/a/node_modules/@b/c`.
export function bundledPackages() {
  return {
    name: 'lightcues:bundled-packages',
    generateBundle(_options, bundle) {
      const dirs = new Map();
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        for (const id of Object.keys(chunk.modules)) {
          const found = packageOf(id);
          if (found) dirs.set(found.path, found.dir);
        }
      }
      const packages = [...dirs].map(([path, dir]) => {
        const { name, version } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
        return { name, version, path };
      });
      packages.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
      this.emitFile({
        type: 'asset',
        fileName: BUNDLED_PACKAGES_FILE,
        source: `${JSON.stringify(packages, null, 2)}\n`,
      });
    },
  };
}

// The package a module id belongs to, or null if it is not from node_modules.
// Ids can be virtual (`\0` prefix, `?commonjs-proxy` suffix) or Windows paths.
export function packageOf(id) {
  const file = id.replace(/^\0/, '').replace(/\?.*$/, '').replaceAll('\\', '/');
  const match = file.match(
    /^(.*?\/)(node_modules\/(?:(?:@[^/]+\/)?[^/]+\/node_modules\/)*(?:@[^/]+\/)?[^/]+)\//,
  );
  if (!match) return null;
  return { path: match[2], dir: match[1] + match[2] };
}
