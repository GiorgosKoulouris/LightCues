import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeFindings, shippedLicenses } from './findings.mjs';

// Trimmed real tool outputs. The fast-xml-parser advisory is made up, so a
// shipped package has a finding.
const fixture = (name) =>
  JSON.parse(readFileSync(join(import.meta.dirname, 'testdata', `${name}.json`), 'utf8'));

const inventory = {
  ships: [
    { name: 'debug', version: '4.4.0', path: 'node_modules/debug' },
    { name: 'electron', version: '44.6.0', path: 'node_modules/electron' },
    { name: 'fast-xml-parser', version: '5.11.2', path: 'node_modules/fast-xml-parser' },
  ],
  devOnly: [{ name: 'sprintf-js', version: '1.1.3', path: 'node_modules/sprintf-js' }],
};

describe('normalizeFindings', () => {
  it('lists an osv-scanner finding once per advisory and package', () => {
    const findings = normalizeFindings(
      { osvLockfile: fixture('osv-lockfile'), osvApp: fixture('osv-app') },
      inventory,
    );

    expect(findings).toEqual([
      {
        id: 'GHSA-hp3w-g68c-fv3c',
        aliases: ['CVE-2026-97058'],
        tool: 'osv-scanner',
        package: 'sprintf-js@1.1.3',
        path: null,
        line: null,
        severity: 'MODERATE',
        cvss: '6.9',
        title: 'sprintf-js vulnerable to denial of service through unbounded precision specifiers',
        scope: 'dev-only',
      },
      {
        id: 'GHSA-xxxx-test-0001',
        aliases: ['CVE-2099-0001'],
        tool: 'osv-scanner',
        package: 'fast-xml-parser@5.11.2',
        path: null,
        line: null,
        severity: 'HIGH',
        cvss: '7.5',
        title: 'fast-xml-parser test advisory',
        scope: 'ships',
      },
    ]);
  });

  it('keeps a finding found only in the app', () => {
    const findings = normalizeFindings({ osvApp: fixture('osv-app') }, inventory);

    expect(findings.map((f) => f.package)).toEqual(['fast-xml-parser@5.11.2']);
  });

  it('lists semgrep findings by file and line', () => {
    const findings = normalizeFindings({ semgrep: fixture('semgrep') }, inventory);

    expect(findings).toEqual([
      {
        id: 'javascript.lang.security.audit.eval-detected.eval-detected',
        aliases: [],
        tool: 'semgrep',
        package: null,
        path: 'src/main/index.ts',
        line: 4,
        severity: 'ERROR',
        cvss: null,
        title: 'eval is bad',
        scope: 'ships',
      },
      {
        id: 'no-eval',
        aliases: [],
        tool: 'semgrep',
        package: null,
        path: 'src/engine/show.test.ts',
        line: 9,
        severity: 'WARNING',
        cvss: null,
        title: 'eval is bad',
        scope: 'dev-only',
      },
    ]);
  });

  it('drops the checkout path from the ids of the committed rules', () => {
    const semgrep = {
      results: fixture('semgrep').results.map((r) => ({
        ...r,
        check_id: r.check_id === 'no-eval' ? 'workspaces.security.semgrep.no-eval' : r.check_id,
      })),
    };

    const findings = normalizeFindings({ semgrep }, inventory, {
      semgrepRulesDir: '/workspaces/security/semgrep',
    });

    expect(findings.map((f) => f.id)).toEqual([
      'javascript.lang.security.audit.eval-detected.eval-detected',
      'no-eval',
    ]);
  });

  it('lists Electronegativity findings, global checks without a file', () => {
    const findings = normalizeFindings(
      { electronegativity: fixture('electronegativity') },
      inventory,
    );

    expect(findings).toEqual([
      {
        id: 'CSP_GLOBAL_CHECK',
        aliases: [],
        tool: 'electronegativity',
        package: null,
        path: 'src/renderer/index.html',
        line: 5,
        severity: 'note',
        cvss: null,
        title: 'One or more CSP directives detected seems to be vulnerable',
        scope: 'ships',
      },
      {
        id: 'LIMIT_NAVIGATION_GLOBAL_CHECK',
        aliases: [],
        tool: 'electronegativity',
        package: null,
        path: null,
        line: null,
        severity: 'warning',
        cvss: null,
        title: 'Missing navigation limits using .on new-window and will-navigate events',
        scope: 'ships',
      },
    ]);
  });

  it('skips tools that did not run', () => {
    expect(normalizeFindings({}, inventory)).toEqual([]);
  });
});

describe('shippedLicenses', () => {
  it('lists the licenses of the shipped packages only', () => {
    const licenses = shippedLicenses(inventory, {
      osvApp: fixture('osv-app'),
      osvLockfile: fixture('osv-lockfile'),
    });

    expect(licenses).toEqual([
      {
        name: 'debug',
        version: '4.4.0',
        path: 'node_modules/debug',
        licenses: ['MIT'],
        allowed: true,
      },
      {
        name: 'electron',
        version: '44.6.0',
        path: 'node_modules/electron',
        licenses: ['MIT'],
        allowed: true,
      },
      {
        name: 'fast-xml-parser',
        version: '5.11.2',
        path: 'node_modules/fast-xml-parser',
        licenses: ['MIT'],
        allowed: true,
      },
    ]);
  });

  it('marks a shipped package osv-scanner has no license for', () => {
    const licenses = shippedLicenses(
      { ships: [{ name: 'left-pad', version: '1.0.0', path: 'node_modules/left-pad' }] },
      { osvApp: fixture('osv-app') },
    );

    expect(licenses).toEqual([
      {
        name: 'left-pad',
        version: '1.0.0',
        path: 'node_modules/left-pad',
        licenses: null,
        allowed: false,
      },
    ]);
  });

  it('marks a shipped package with a license off the allow list', () => {
    const left = { name: 'left-pad', version: '1.0.0' };
    const licenses = shippedLicenses(
      { ships: [{ ...left, path: 'node_modules/left-pad' }] },
      {
        osvApp: { results: [{ packages: [{ package: left, licenses: ['MIT', 'GPL-2.0-only'] }] }] },
      },
    );

    expect(licenses[0].allowed).toBe(false);
  });
});
