import { describe, expect, it } from 'vitest';
import { beamLanding, turnAim, type AimAngles, type Turn } from '../shared/aim';
import type { Capability, Channel } from '../shared/fixture-profile';
import { EFFECT_SHAPES, type EffectShape, type MovementEffect, type Spread } from '../shared/show';
import { DEFAULT_MOUNTING, type Mounting, type StagePosition } from '../shared/venue-patch';
import { effectTurn, spreadDelay } from './movement-effects';

// The turn a Pan sweep of 10° over 4 beats, changed by `overrides`, gives
// Fixture `id` at `beat`, `delay` of a cycle behind.
function turn(
  overrides: Partial<MovementEffect>,
  beat: number,
  { delay = 0, id = 'mover' } = {},
): Turn {
  const effect: MovementEffect = {
    shape: 'Pan sweep',
    size: 10,
    length: 4,
    spread: 'In sync',
    ...overrides,
  };
  return effectTurn(effect, beat, delay, id);
}

function expectTurn(actual: Turn, pan: number, tilt: number) {
  expect(actual.pan).toBeCloseTo(pan, 6);
  expect(actual.tilt).toBeCloseTo(tilt, 6);
}

// Beats 0, 1, 2, 3 and 4: 0, ¼, ½, ¾ and 1 of the length.
const QUARTERS = [0, 1, 2, 3, 4];

// A shape's [pan, tilt] at each of `QUARTERS`.
function expectQuarters(shape: EffectShape, expected: [number, number][]) {
  QUARTERS.forEach((beat, i) => expectTurn(turn({ shape }, beat), ...expected[i]!));
}

describe('effectTurn', () => {
  it('sweeps pan around the base aim, size degrees each way', () => {
    expectQuarters('Pan sweep', [
      [0, 0],
      [10, 0],
      [0, 0],
      [-10, 0],
      [0, 0],
    ]);
  });

  it('sweeps tilt around the base aim, size degrees each way', () => {
    expectQuarters('Tilt sweep', [
      [0, 0],
      [0, 10],
      [0, 0],
      [0, -10],
      [0, 0],
    ]);
  });

  it('circles size degrees from the base aim, tilt a quarter cycle ahead of pan', () => {
    expectQuarters('Circle', [
      [0, 10],
      [10, 0],
      [0, -10],
      [-10, 0],
      [0, 10],
    ]);
    for (const beat of [0.4, 1.2, 2.8]) {
      const { pan, tilt } = turn({ shape: 'Circle' }, beat);
      expect(Math.hypot(pan, tilt)).toBeCloseTo(10, 6);
    }
  });

  describe('Ballyhoo', () => {
    const ballyhoo = (beat: number, { size = 10, id = 'mover' } = {}) =>
      turn({ shape: 'Ballyhoo', size }, beat, { id });

    it('turns as it does now for a Fixture, repeating each cycle', () => {
      // Pinned: the offsets come from the Fixture id, so a change to the
      // seeding or the waves moves every Ballyhoo on the rig.
      expectQuarters('Ballyhoo', [
        [-5.337192, 9.832341],
        [-2.53864, -0.65669],
        [-0.619091, -9.832341],
        [8.494923, 0.65669],
        [-5.337192, 9.832341],
      ]);
    });

    it('stays within size degrees on each axis', () => {
      for (let beat = 0; beat < 4; beat += 1 / 16) {
        const { pan, tilt } = ballyhoo(beat);
        expect(Math.abs(pan)).toBeLessThanOrEqual(10);
        expect(Math.abs(tilt)).toBeLessThanOrEqual(10);
      }
    });

    it('scales with its size', () => {
      for (const beat of [0, 1, 2.5]) {
        const { pan, tilt } = ballyhoo(beat);
        expectTurn(ballyhoo(beat, { size: 20 }), 2 * pan, 2 * tilt);
      }
    });

    it('is the same each time for a Fixture, and differs between Fixtures', () => {
      expect(ballyhoo(1.5)).toEqual(ballyhoo(1.5));
      expect(ballyhoo(1.5, { id: 'twin' })).not.toEqual(ballyhoo(1.5));
    });
  });

  it('halves the speed when the length doubles, at the same Tempo', () => {
    for (const shape of EFFECT_SHAPES) {
      for (const beat of [0.5, 1, 3]) {
        const { pan, tilt } = turn({ shape, length: 4 }, beat);
        expectTurn(turn({ shape, length: 8 }, 2 * beat), pan, tilt);
      }
    }
  });

  it('runs `delay` of a cycle behind', () => {
    // A quarter cycle behind at beat 2 of 4 is where it was at beat 1.
    for (const shape of EFFECT_SHAPES) {
      const { pan, tilt } = turn({ shape }, 1);
      expectTurn(turn({ shape }, 2, { delay: 0.25 }), pan, tilt);
    }
  });
});

describe('spreadDelay', () => {
  const at = (x: number): StagePosition => ({ x, y: 4, height: 6 });
  // Across the stage, out of order.
  const line = [at(4), at(-2), at(-4), at(2)];
  const delays = (spread: Spread) =>
    Object.fromEntries(line.map((position) => [position.x, spreadDelay(spread, position, line)]));

  it('runs every Fixture together In sync', () => {
    expect(delays('In sync')).toEqual({ '-4': 0, '-2': 0, 2: 0, 4: 0 });
  });

  it('runs from the lowest x up, Left→Right, spread over a cycle', () => {
    expect(delays('Left→Right')).toEqual({ '-4': 0, '-2': 0.25, 2: 0.5, 4: 0.75 });
  });

  it('runs from the centre out, Mirrored, the same each side', () => {
    expect(delays('Mirrored')).toEqual({ '-4': 0.5, '-2': 0, 2: 0, 4: 0.5 });
  });

  it('runs every other Fixture half a cycle behind, Alternate', () => {
    expect(delays('Alternate')).toEqual({ '-4': 0, '-2': 0.5, 2: 0, 4: 0.5 });
  });

  it('gives Fixtures at the same x the same delay, spread over the distinct x', () => {
    // Two at x -3 and two at x 1, at different depths and heights.
    const twins = [at(-3), at(1), { ...at(-3), y: 1 }, { ...at(1), height: 2 }];
    const expected: Record<Spread, [number, number]> = {
      'In sync': [0, 0],
      'Left→Right': [0, 0.5],
      Mirrored: [0.5, 0],
      Alternate: [0, 0.5],
    };
    for (const [spread, [left, right]] of Object.entries(expected)) {
      expect(twins.map((position) => spreadDelay(spread as Spread, position, twins))).toEqual([
        left,
        right,
        left,
        right,
      ]);
    }
  });

  it('is 0 for a Fixture the Effect does not target', () => {
    expect(spreadDelay('Left→Right', at(1), line)).toBe(0);
  });
});

// An Effect's turn on a Fixture, through `turnAim`: Mounting, limits and the
// axes the Fixture has.
describe('an Effect on a Fixture', () => {
  function control(name: string, capability: Capability): Channel {
    return { kind: 'control', name, defaultValue: 0, ranges: [{ from: 0, to: 255, capability }] };
  }
  const pan = control('Pan', { type: 'pan', degrees: [-270, 270] });
  const tilt = control('Tilt', { type: 'tilt', degrees: [-135, 135] });
  const mover = [pan, tilt];

  // A quarter cycle in, where each sweep is at its full size.
  const peak = (shape: EffectShape, size = 10) => turn({ shape, size }, 1);

  function turned(
    by: Turn,
    {
      angles = { pan: 0, tilt: 0 },
      channels = mover,
      mounting = {},
    }: { angles?: AimAngles; channels?: Channel[]; mounting?: Partial<Mounting> } = {},
  ): AimAngles {
    return turnAim(channels, { ...DEFAULT_MOUNTING, ...mounting }, angles, by);
  }

  it('moves size degrees whatever the pan range', () => {
    const narrow = control('Pan', { type: 'pan', degrees: [0, 180] });
    const wide = control('Pan', { type: 'pan', degrees: [0, 630] });
    for (const range of [narrow, wide, pan]) {
      expect(turned(peak('Pan sweep'), { channels: [range, tilt] }).pan).toBeCloseTo(10, 6);
    }
  });

  it('clamps a move past the pan or tilt range at its end, not wrapped round', () => {
    expect(turned(peak('Pan sweep', 20), { angles: { pan: 260, tilt: 0 } }).pan).toBe(270);
    expect(turned(peak('Tilt sweep', 20), { angles: { pan: 0, tilt: 130 } }).tilt).toBe(135);
    const back = turn({ shape: 'Tilt sweep', size: 20 }, 3);
    expect(turned(back, { angles: { pan: 0, tilt: -130 } }).tilt).toBe(-135);
  });

  it('moves an inverted axis the mirror way', () => {
    const circle = turn({ shape: 'Circle' }, 0.5);
    const plain = turned(circle);
    expect(turned(circle, { mounting: { panInvert: true } })).toEqual({
      pan: -plain.pan!,
      tilt: plain.tilt,
    });
    expect(turned(circle, { mounting: { tiltInvert: true } })).toEqual({
      pan: plain.pan,
      tilt: -plain.tilt!,
    });
  });

  describe('Hung or Standing', () => {
    // The same channel turn either way: the Effect turns the Fixture in its
    // own frame, so the world sees it flipped.
    const stage = { width: 10, depth: 8 };
    function landing(mount: Mounting['mount'], height: number, by: Turn): StagePosition {
      const mounting = { ...DEFAULT_MOUNTING, mount };
      // Tilted 80° toward the audience.
      const angles = turnAim(mover, mounting, { pan: 0, tilt: 80 }, by);
      return beamLanding({ position: { x: 0, y: 4, height }, mounting, stage, angles });
    }

    it('turns the same channel degrees', () => {
      const circle = peak('Circle');
      expect(turned(circle, { mounting: { mount: 'Standing' } })).toEqual(turned(circle));
    });

    it('tilts away from the yoke axis: up when Hung, down when Standing', () => {
      // Both land on the audience plane, the beam near level.
      const still = { pan: 0, tilt: 0 };
      const up = peak('Tilt sweep');
      expect(landing('Hung', 6, up).height).toBeGreaterThan(landing('Hung', 6, still).height);
      expect(landing('Standing', 1, up).height).toBeLessThan(landing('Standing', 1, still).height);
    });

    it('pans opposite ways seen from above', () => {
      const right = peak('Pan sweep');
      expect(Math.sign(landing('Hung', 6, right).x)).toBe(
        -Math.sign(landing('Standing', 1, right).x),
      );
    });
  });

  it('uses only the axis a Fixture has, dropping the other', () => {
    const circle = turn({ shape: 'Circle' }, 0.5);
    expect(turned(circle, { channels: [pan], angles: { pan: 0 } })).toEqual({ pan: circle.pan });
    expect(turned(circle, { channels: [tilt], angles: { tilt: 0 } })).toEqual({
      tilt: circle.tilt,
    });
  });
});
