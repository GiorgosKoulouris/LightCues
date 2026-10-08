import { describe, expect, it } from 'vitest';
import { cieToHex } from './cie-colour';

describe('cieToHex', () => {
  it('maps the D65 white point to white', () => {
    expect(cieToHex('0.3127,0.3290,100')).toBe('#ffffff');
  });

  it('maps the sRGB primaries to pure red, green and blue', () => {
    expect(cieToHex('0.64,0.33,21.26')).toBe('#ff0000');
    expect(cieToHex('0.30,0.60,71.52')).toBe('#00ff00');
    expect(cieToHex('0.15,0.06,7.22')).toBe('#0000ff');
  });

  it('shows a filter at full brightness, whatever its transmission Y', () => {
    expect(cieToHex('0.64,0.33,2')).toBe('#ff0000');
    expect(cieToHex('0.3127,0.3290,5')).toBe('#ffffff');
  });

  it('clips colours outside the sRGB gamut', () => {
    expect(cieToHex('0.70,0.29,10')).toBe('#ff0000');
  });

  it('gives white for a missing or unreadable colour', () => {
    expect(cieToHex(undefined)).toBe('#ffffff');
    expect(cieToHex('red')).toBe('#ffffff');
    expect(cieToHex('0.3,0,10')).toBe('#ffffff');
  });
});
