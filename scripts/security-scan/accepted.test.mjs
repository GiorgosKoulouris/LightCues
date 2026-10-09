import { describe, expect, it } from 'vitest';
import { matchAccepted, parseAccepted } from './accepted.mjs';

const finding = (overrides) => ({
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
  ...overrides,
});

const semgrepFinding = finding({
  id: 'electron-ipc-unvalidated-payload',
  aliases: [],
  tool: 'semgrep',
  package: null,
  path: 'src/main/ipc.ts',
  line: 42,
  severity: 'WARNING',
  cvss: null,
  title: 'IPC payload used without validation',
});

const entry = (overrides) => ({
  id: 'GHSA-xxxx-test-0001',
  package: 'fast-xml-parser@5.11.2',
  reason: 'Only parses files the user picked.',
  accepted: '2026-10-01',
  reviewBy: '2027-01-01',
  ...overrides,
});

describe('parseAccepted', () => {
  it('reads an empty file, comments only, as no entries', () => {
    expect(parseAccepted('# - id: GHSA-...\n#   package: x@1.0.0\n')).toEqual([]);
  });

  it('keeps dates as strings', () => {
    const entries = parseAccepted(
      [
        '- id: CVE-2099-0001',
        '  path: src/main/ipc.ts',
        '  reason: Checked by hand.',
        '  accepted: 2026-10-01',
        '  reviewBy: 2027-01-01',
      ].join('\n'),
    );

    expect(entries).toEqual([
      {
        id: 'CVE-2099-0001',
        path: 'src/main/ipc.ts',
        reason: 'Checked by hand.',
        accepted: '2026-10-01',
        reviewBy: '2027-01-01',
      },
    ]);
  });

  const valid = {
    id: 'GHSA-aaaa-test-0001',
    package: 'debug@4.4.0',
    reason: 'Fine.',
    accepted: '2026-10-01',
    reviewBy: '2027-01-01',
  };
  const toYaml = (fields) =>
    Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `  ${key}: ${value}`)
      .join('\n')
      .replace(/^ {2}/, '- ');
  // Entry 1 is valid. Entry 2 has the changes. An undefined field is left out.
  const fileWith = (changes) => `${toYaml(valid)}\n${toYaml({ ...valid, ...changes })}`;

  it.each([
    ['a missing field', { reason: undefined }, 'missing reason'],
    ['both package and path', { path: 'src/a.ts' }, 'needs package or path, not both'],
    ['neither package nor path', { package: undefined }, 'needs package or path'],
    ['an unknown field', { reviewby: '2027-01-01' }, 'unknown field reviewby'],
    ['a bad date', { reviewBy: '2027-02-30' }, 'reviewBy 2027-02-30 is not a YYYY-MM-DD date'],
    ['review-by before accepted', { reviewBy: '2026-09-01' }, 'reviewBy is before accepted'],
    ['a package without a version', { package: 'debug' }, 'package must be name@version'],
  ])('fails on %s with the entry index', (_, changes, message) => {
    expect(() => parseAccepted(fileWith(changes))).toThrow(
      `security/accepted.yml entry 2: ${message}`,
    );
  });

  it('fails on a file that is not a list', () => {
    expect(() => parseAccepted('id: GHSA-aaaa-test-0001\n')).toThrow(
      'security/accepted.yml must be a list of entries',
    );
  });

  it('fails on invalid YAML', () => {
    expect(() => parseAccepted('- id: [\n')).toThrow('security/accepted.yml is not valid YAML');
  });
});

describe('matchAccepted', () => {
  it('matches a finding by an alias of its id and its package', () => {
    const accepted = entry({ id: 'CVE-2099-0001' });

    const result = matchAccepted([finding()], [accepted], '2026-10-09');

    expect(result).toEqual({
      matched: [{ ...accepted, findings: [finding()] }],
      expired: [],
      unused: [],
    });
  });

  it('matches a code finding by file, on any line', () => {
    const accepted = {
      id: 'electron-ipc-unvalidated-payload',
      path: 'src/main/ipc.ts',
      reason: 'Checked by hand.',
      accepted: '2026-10-01',
      reviewBy: '2027-01-01',
    };
    const other = { ...semgrepFinding, line: 99 };

    const result = matchAccepted([semgrepFinding, other], [accepted], '2026-10-09');

    expect(result.matched).toEqual([{ ...accepted, findings: [semgrepFinding, other] }]);
  });

  it('does not match another version of the package', () => {
    const result = matchAccepted(
      [finding({ package: 'fast-xml-parser@5.12.0' })],
      [entry()],
      '2026-10-09',
    );

    expect(result).toEqual({ matched: [], expired: [], unused: [{ ...entry(), findings: [] }] });
  });

  it('lists an entry past its review-by date as expired, with its findings', () => {
    const accepted = entry({ reviewBy: '2026-10-08' });

    const result = matchAccepted([finding()], [accepted], '2026-10-09');

    expect(result).toEqual({
      matched: [],
      expired: [{ ...accepted, findings: [finding()] }],
      unused: [],
    });
  });

  it('lists an expired entry as expired even when it matches nothing', () => {
    const accepted = entry({ reviewBy: '2026-10-08' });

    const result = matchAccepted([semgrepFinding], [accepted], '2026-10-09');

    expect(result).toEqual({ matched: [], expired: [{ ...accepted, findings: [] }], unused: [] });
  });

  it('keeps an entry on its review-by date', () => {
    const result = matchAccepted([finding()], [entry({ reviewBy: '2026-10-09' })], '2026-10-09');

    expect(result.matched).toHaveLength(1);
  });

  it('lists an entry that matches no finding as unused', () => {
    const result = matchAccepted([semgrepFinding], [entry()], '2026-10-09');

    expect(result).toEqual({ matched: [], expired: [], unused: [{ ...entry(), findings: [] }] });
  });
});
