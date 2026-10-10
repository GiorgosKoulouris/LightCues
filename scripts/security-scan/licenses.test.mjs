import { describe, expect, it } from 'vitest';
import { isAllowedLicense } from './licenses.mjs';

describe('isAllowedLicense', () => {
  it('allows a listed license id', () => {
    expect(isAllowedLicense('MIT')).toBe(true);
    expect(isAllowedLicense('0BSD')).toBe(true);
  });

  it('rejects an unlisted or unknown id', () => {
    expect(isAllowedLicense('GPL-2.0-only')).toBe(false);
    expect(isAllowedLicense('UNKNOWN')).toBe(false);
    expect(isAllowedLicense('SEE LICENSE IN LICENSE.txt')).toBe(false);
    expect(isAllowedLicense('')).toBe(false);
  });

  it('needs one allowed side of an OR, and both sides of an AND', () => {
    expect(isAllowedLicense('(MIT OR GPL-2.0-only)')).toBe(true);
    expect(isAllowedLicense('MIT AND ISC')).toBe(true);
    expect(isAllowedLicense('MIT AND GPL-2.0-only')).toBe(false);
    expect(isAllowedLicense('(MIT AND ISC) OR SSPL-1.0')).toBe(true);
  });

  it('rejects a malformed expression', () => {
    expect(isAllowedLicense('(MIT')).toBe(false);
    expect(isAllowedLicense('MIT ISC')).toBe(false);
    expect(isAllowedLicense('Apache-2.0 WITH LLVM-exception')).toBe(false);
  });
});
