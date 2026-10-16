import { describe, expect, it } from 'vitest';
import { SPEED_LIMIT, type MovementEffect } from './show';
import { fitSpeedLimit } from './speed-limit';

// A Pan sweep of 10° over 1 beat, changed by `overrides`.
function effect(overrides: Partial<MovementEffect> = {}): MovementEffect {
  return { shape: 'Pan sweep', size: 10, length: 1, spread: 'In sync', ...overrides };
}

// The BPM at which `weight` × `size` degrees over `length` beats peaks at
// exactly the Speed limit.
function bpmAtLimit(size: number, length: number, weight = 1): number {
  return (SPEED_LIMIT * 60 * length) / (2 * Math.PI * weight * size);
}

describe('fitSpeedLimit', () => {
  it('is 300°/s', () => {
    expect(SPEED_LIMIT).toBe(300);
  });

  it('runs an Effect under the limit as programmed', () => {
    expect(fitSpeedLimit(effect(), 120)).toEqual({ length: 1, size: 10, limited: false });
  });

  it('fits an Effect at exactly the limit', () => {
    expect(fitSpeedLimit(effect(), bpmAtLimit(10, 1))).toEqual({
      length: 1,
      size: 10,
      limited: false,
    });
  });

  it('steps up through the lengths as the Tempo rises', () => {
    const quarter = effect({ length: 0.25 });
    // 10° reaches the limit at about 72 BPM at 1/4 beat, 143 at 1/2 and 286
    // at 1.
    expect(fitSpeedLimit(quarter, 60).length).toBe(0.25);
    expect(fitSpeedLimit(quarter, 100)).toEqual({ length: 0.5, size: 10, limited: true });
    expect(fitSpeedLimit(quarter, 200).length).toBe(1);
    expect(fitSpeedLimit(quarter, 400).length).toBe(2);
  });

  it('never runs an Effect shorter than programmed', () => {
    expect(fitSpeedLimit(effect({ length: 2 }), 30)).toEqual({
      length: 2,
      size: 10,
      limited: false,
    });
  });

  it('keeps the size while a longer length fits', () => {
    expect(fitSpeedLimit(effect({ size: 45, length: 0.25 }), 140)).toEqual({
      length: 4,
      size: 45,
      limited: true,
    });
  });

  it('limits Pan sweep, Tilt sweep and Circle at the size, on their faster axis', () => {
    for (const shape of ['Pan sweep', 'Tilt sweep', 'Circle'] as const) {
      const at = bpmAtLimit(10, 1);
      expect(fitSpeedLimit(effect({ shape }), at).length).toBe(1);
      expect(fitSpeedLimit(effect({ shape }), at + 1).length).toBe(2);
    }
  });

  it("limits a Ballyhoo at 1.8× its size, its tilt's peak", () => {
    const at = bpmAtLimit(10, 1, 1.8);
    expect(fitSpeedLimit(effect({ shape: 'Ballyhoo' }), at).length).toBe(1);
    expect(fitSpeedLimit(effect({ shape: 'Ballyhoo' }), at + 1).length).toBe(2);
  });

  it('shrinks the size to exactly the limit when 16 beats is still too fast', () => {
    const big = effect({ size: 180, length: 4 });
    const bpm = 2 * bpmAtLimit(180, 16);
    const sweep = fitSpeedLimit(big, bpm);
    expect(sweep).toMatchObject({ length: 16, limited: true });
    expect(sweep.size).toBeCloseTo(90);

    const ballyhoo = fitSpeedLimit({ ...big, shape: 'Ballyhoo' }, bpm);
    expect(ballyhoo.length).toBe(16);
    expect(ballyhoo.size).toBeCloseTo(50);
  });

  it('takes a lower limit', () => {
    const at = bpmAtLimit(10, 1);
    expect(fitSpeedLimit(effect(), at, 0.9 * SPEED_LIMIT).length).toBe(2);
  });
});
