import { describe, expect, it } from 'vitest';
import { pixelScale } from './pixelScale';

describe('pixelScale', () => {
  it('fits the view inside the box, as SVG does by default', () => {
    // 10 × 5 m view in an 800 × 600 px box: width limits it, 80 px per metre.
    expect(pixelScale({ width: 800, height: 600 }, { width: 10, height: 5 })).toBe(80);
    // In an 800 × 200 px box, height limits it: 40 px per metre.
    expect(pixelScale({ width: 800, height: 200 }, { width: 10, height: 5 })).toBe(40);
  });

  it('uses the width alone when the height follows the aspect ratio', () => {
    expect(pixelScale({ width: 500, height: 0 }, { width: 10, height: 5 })).toBe(50);
  });

  it('keeps the padding clear around the view, in pixels', () => {
    expect(pixelScale({ width: 880, height: 600 }, { width: 10, height: 5 }, 40)).toBe(80);
  });

  it('is undefined for a box with no size, or no room inside its padding', () => {
    expect(pixelScale({ width: 0, height: 0 }, { width: 10, height: 5 })).toBeUndefined();
    expect(pixelScale({ width: 80, height: 0 }, { width: 10, height: 5 }, 40)).toBeUndefined();
  });
});
