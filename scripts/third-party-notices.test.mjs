import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildNotices, NoticesError } from './third-party-notices.mjs';

const MIT_TEXT = 'MIT License\n\nCopyright (c) Someone\n';

// Files by path under dir.
function writeFiles(dir, files) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), typeof content === 'string' ? content : JSON.stringify(content));
  }
}

describe('buildNotices', () => {
  let appDir, projectDir;
  beforeEach(() => {
    appDir = mkdtempSync(join(tmpdir(), 'notices-app-'));
    projectDir = mkdtempSync(join(tmpdir(), 'notices-project-'));
    writeFiles(projectDir, {
      'examples/README.md':
        '# Examples\n\n## Fixture data\n\nFrom Open Fixture Library:\n\n```\nMIT License\n\nCopyright (c) 2017 Florian & Felix Edelmann\n```\n',
    });
  });
  afterEach(() => {
    rmSync(appDir, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  });

  const ship = (name, version, extra = {}) => ({
    name,
    version,
    path: `node_modules/${name}`,
    ...extra,
  });

  it('includes each package’s license id and license files', () => {
    writeFiles(appDir, {
      'node_modules/fflate/package.json': { name: 'fflate', version: '0.8.3', license: 'MIT' },
      'node_modules/fflate/LICENSE': MIT_TEXT,
      'node_modules/tslib/package.json': { name: 'tslib', version: '2.8.1', license: '0BSD' },
      'node_modules/tslib/LICENSE.txt': 'Copyright (c) Microsoft Corporation.\n',
      'node_modules/tslib/NOTICE': 'A notice.\n',
    });
    const inventory = { ships: [ship('tslib', '2.8.1'), ship('fflate', '0.8.3')] };

    const notices = buildNotices({ appDir, projectDir, inventory });

    expect(notices).toContain('fflate 0.8.3\nLicense: MIT\n\n--- LICENSE ---\n\n' + MIT_TEXT);
    expect(notices).toContain('tslib 2.8.1\nLicense: 0BSD');
    expect(notices).toContain('--- LICENSE.txt ---\n\nCopyright (c) Microsoft Corporation.');
    expect(notices).toContain('--- NOTICE ---\n\nA notice.');
    expect(notices.indexOf('fflate')).toBeLessThan(notices.indexOf('tslib'));
  });

  it('reads a bundled package from the project, and leaves out Electron', () => {
    writeFiles(projectDir, {
      'node_modules/react/package.json': { name: 'react', version: '19.3.0', license: 'MIT' },
      'node_modules/react/LICENSE': 'Copyright (c) Meta Platforms, Inc.\n',
    });
    const inventory = {
      ships: [ship('react', '19.3.0', { bundled: true }), ship('electron', '44.7.0')],
    };

    const notices = buildNotices({ appDir, projectDir, inventory });

    expect(notices).toContain('react 19.3.0\nLicense: MIT');
    expect(notices).toContain('Copyright (c) Meta Platforms, Inc.');
    expect(notices).not.toContain('electron 44.7.0');
  });

  it('lists a package that ships twice once', () => {
    writeFiles(appDir, {
      'node_modules/debug/package.json': { name: 'debug', version: '4.4.0', license: 'MIT' },
      'node_modules/debug/LICENSE': MIT_TEXT,
      'node_modules/a/node_modules/debug/package.json': { name: 'debug', version: '4.4.0' },
    });
    const inventory = {
      ships: [
        ship('debug', '4.4.0'),
        { name: 'debug', version: '4.4.0', path: 'node_modules/a/node_modules/debug' },
      ],
    };

    const notices = buildNotices({ appDir, projectDir, inventory });

    expect(notices.match(/debug 4\.4\.0/g)).toHaveLength(1);
  });

  it('credits the Open Fixture Library data from the examples README', () => {
    const notices = buildNotices({ appDir, projectDir, inventory: { ships: [] } });

    expect(notices).toContain('Open Fixture Library fixture data\nLicense: MIT\n');
    expect(notices).toMatch(/\n\nMIT License\n\nCopyright \(c\) 2017 Florian & Felix Edelmann\n$/);
    expect(notices).not.toContain('From Open Fixture Library:');
  });

  it('fails if the examples README lost the fixture data license', () => {
    writeFiles(projectDir, { 'examples/README.md': '# Examples\n\n## Fixture data\n\nMIT.\n' });

    expect(() => buildNotices({ appDir, projectDir, inventory: { ships: [] } })).toThrow(
      /no license block under "## Fixture data"/,
    );
  });

  it('fails if a package has no license file', () => {
    writeFiles(appDir, {
      'node_modules/left-pad/package.json': { name: 'left-pad', version: '1.0.0', license: 'MIT' },
    });
    const inventory = { ships: [ship('left-pad', '1.0.0')] };

    expect(() => buildNotices({ appDir, projectDir, inventory })).toThrow(
      /left-pad@1\.0\.0: no license file/,
    );
  });

  it('uses the fallback copy for a package that ships no license file', () => {
    writeFiles(appDir, {
      'node_modules/left-pad/package.json': { name: 'left-pad', version: '1.0.0', license: 'MIT' },
    });
    writeFiles(projectDir, { 'build/licenses/left-pad@1.0.0.txt': MIT_TEXT });
    const inventory = { ships: [ship('left-pad', '1.0.0')] };

    const notices = buildNotices({ appDir, projectDir, inventory });

    expect(notices).toContain(
      'left-pad 1.0.0\nLicense: MIT\n\n--- LICENSE (upstream copy) ---\n\n' + MIT_TEXT,
    );
  });

  it('fails if a package’s license is not on the allow list, or missing', () => {
    writeFiles(appDir, {
      'node_modules/gpl2/package.json': { name: 'gpl2', version: '1.0.0', license: 'GPL-2.0-only' },
      'node_modules/gpl2/LICENSE': 'GPL v2\n',
      'node_modules/none/package.json': { name: 'none', version: '1.0.0' },
      'node_modules/none/LICENSE': 'Some text\n',
    });
    const inventory = { ships: [ship('gpl2', '1.0.0'), ship('none', '1.0.0')] };

    const build = () => buildNotices({ appDir, projectDir, inventory });

    expect(build).toThrow(NoticesError);
    expect(build).toThrow(/gpl2@1\.0\.0: license GPL-2\.0-only is not allowed/);
    expect(build).toThrow(/none@1\.0\.0: license missing is not allowed/);
  });

  it('reads the old `licenses` field', () => {
    writeFiles(appDir, {
      'node_modules/old/package.json': {
        name: 'old',
        version: '1.0.0',
        licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }],
      },
      'node_modules/old/LICENSE-MIT': MIT_TEXT,
    });
    const inventory = { ships: [ship('old', '1.0.0')] };

    expect(buildNotices({ appDir, projectDir, inventory })).toContain(
      'old 1.0.0\nLicense: (MIT OR Apache-2.0)\n\n--- LICENSE-MIT ---',
    );
  });
});
