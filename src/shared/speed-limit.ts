// The length and size a movement Effect runs at to stay under the Speed limit
// (ADR 0015). Shared so the engine and the Effect editor agree. Pure.
import {
  EFFECT_LENGTHS,
  SPEED_LIMIT,
  type EffectLength,
  type EffectShape,
  type MovementEffect,
} from './show';

// How fast each axis turns at its peak, per degree of size and cycle per
// second, over 2π. A Ballyhoo's waves, at 1 and 2 cycles on pan and 1 and 3
// on tilt, are taken at their worst, in step whatever the Fixture's offsets.
// Kept in step with `effectTurn` in the engine's effects.
const AXIS_WEIGHTS: Record<EffectShape, { pan: number; tilt: number }> = {
  Circle: { pan: 1, tilt: 1 },
  'Pan sweep': { pan: 1, tilt: 0 },
  'Tilt sweep': { pan: 0, tilt: 1 },
  Ballyhoo: { pan: 0.6 * 1 + 0.4 * 2, tilt: 0.6 * 1 + 0.4 * 3 },
};

// Slack for rounding, so an Effect at exactly the limit fits.
const TOLERANCE = 1e-9;

// The longest Effect length, where the size shrinks if still too fast.
const LONGEST: EffectLength = EFFECT_LENGTHS[EFFECT_LENGTHS.length - 1]!;

// The length and size an Effect runs at, and whether either differs from the
// Effect as programmed.
export interface SpeedLimitFit {
  length: EffectLength;
  size: number;
  limited: boolean;
}

// What an Effect runs at, at `bpm`, to stay at or under `limit` (degrees per
// second) on both axes: the shortest length from the one programmed that
// fits, at its full size. If none does, 16 beats at the largest size that
// fits.
export function fitSpeedLimit(
  effect: MovementEffect,
  bpm: number,
  limit: number = SPEED_LIMIT,
): SpeedLimitFit {
  const { shape, size } = effect;
  const length = EFFECT_LENGTHS.find(
    (l) => l >= effect.length && peakSpeed(shape, size, l, bpm) <= limit * (1 + TOLERANCE),
  );
  if (length !== undefined) return { length, size, limited: length !== effect.length };
  return {
    length: LONGEST,
    size: (size * limit) / peakSpeed(shape, size, LONGEST, bpm),
    limited: true,
  };
}

// The peak speed of the faster axis, in degrees per second, of a `shape` of
// `size` degrees over `length` beats at `bpm`. 0 for a Tempo that is not over
// 0, so the Effect runs as programmed.
function peakSpeed(shape: EffectShape, size: number, length: number, bpm: number): number {
  if (!(bpm > 0)) return 0;
  const { pan, tilt } = AXIS_WEIGHTS[shape];
  return 2 * Math.PI * Math.max(pan, tilt) * size * (bpm / 60 / length);
}
