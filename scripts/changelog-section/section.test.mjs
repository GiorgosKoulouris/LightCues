import { describe, expect, it } from 'vitest';
import { changelogSection } from './section.mjs';

const changelog = `# Changelog

Intro text.

## [Unreleased]

### Added

- Something new

## [0.2.0] - 2026-11-01

### Fixed

- A fix

## [0.1.10] - 2026-10-20

### Added

- Ten

## [0.1.1] - 2026-10-09

### Added

- First line
- Second line

### Changed

- A change

## [0.1.0] - 2026-09-01

### Added

- The first release
`;

describe('changelogSection', () => {
  it('returns the body of a version section, without its heading', () => {
    expect(changelogSection(changelog, '0.1.1')).toBe(
      '### Added\n\n- First line\n- Second line\n\n### Changed\n\n- A change',
    );
  });

  it('stops at the next version heading', () => {
    expect(changelogSection(changelog, '0.2.0')).toBe('### Fixed\n\n- A fix');
  });

  it('reads the last section to the end of the file', () => {
    expect(changelogSection(changelog, '0.1.0')).toBe('### Added\n\n- The first release');
  });

  it('matches the version exactly, not as a prefix', () => {
    expect(changelogSection(changelog, '0.1.1')).not.toContain('Ten');
    expect(changelogSection(changelog, '0.1.10')).toBe('### Added\n\n- Ten');
  });

  it('treats dots in the version literally', () => {
    expect(() => changelogSection(changelog, '0x1x0')).toThrow(/No section for 0x1x0/);
  });

  it('accepts a heading without a date', () => {
    expect(changelogSection('## [1.0.0]\n\n- Done\n', '1.0.0')).toBe('- Done');
  });

  it('accepts a prerelease version', () => {
    expect(changelogSection('## [1.0.0-rc.1] - 2026-12-01\n\n- RC\n', '1.0.0-rc.1')).toBe('- RC');
  });

  it('fails when the section is missing', () => {
    expect(() => changelogSection(changelog, '9.9.9')).toThrow(/No section for 9\.9\.9/);
  });

  it('fails when the section is empty', () => {
    expect(() => changelogSection('## [1.0.0]\n\n## [0.9.0]\n\n- Old\n', '1.0.0')).toThrow(
      /The section for 1\.0\.0 is empty/,
    );
  });

  it('fails when the section holds only subheadings', () => {
    expect(() => changelogSection('## [1.0.0]\n\n### Added\n\n### Fixed\n', '1.0.0')).toThrow(
      /The section for 1\.0\.0 is empty/,
    );
  });

  it('reads Windows line endings', () => {
    expect(changelogSection('## [1.0.0]\r\n\r\n- Done\r\n', '1.0.0')).toBe('- Done');
  });
});
