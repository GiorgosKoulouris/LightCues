// Effects: where a movement Effect turns a moving Fixture from its base aim,
// in degrees, how an intensity Effect scales its intensity, and which colours
// a colour Effect mixes, at a point in the Tempo's beat count. Pure.
import type { Turn } from '../shared/aim';
import type {
  Colour,
  ColourEffect,
  IntensityEffect,
  IntensityShape,
  MovementEffect,
  Spread,
} from '../shared/show';
import type { StagePosition } from '../shared/venue-patch';

// The turn an Effect gives a Fixture at `beat`. `delay` is how far behind the
// cycle the Fixture runs under the Effect's Spread, 0–1.
export function effectTurn(
  { shape, size, length }: MovementEffect,
  beat: number,
  delay: number,
  fixtureId: string,
): Turn {
  // Cycles run so far.
  const cycle = beat / length - delay;
  const wave = (cycles: number, offset = 0) => Math.sin(2 * Math.PI * (cycles * cycle + offset));
  switch (shape) {
    case 'Circle':
      return { pan: size * wave(1), tilt: size * wave(1, 0.25) };
    case 'Pan sweep':
      return { pan: size * wave(1), tilt: 0 };
    case 'Tilt sweep':
      return { pan: 0, tilt: size * wave(1) };
    case 'Ballyhoo': {
      // Two waves per axis at whole cycles, so it repeats each cycle, with
      // offsets of the Fixture's own. The weights add up to 1: at most `size`.
      const [a, b, c, d] = seeded(fixtureId, 4);
      return {
        pan: size * (0.6 * wave(1, a) + 0.4 * wave(2, b)),
        tilt: size * (0.6 * wave(1, c) + 0.4 * wave(3, d)),
      };
    }
  }
}

// How much an intensity Effect scales a Fixture's intensity at `beat`, 0–1.
// `delay` is as for `effectTurn`. `positions` is how many Spread positions the
// targeted Fixtures take: a Chase lights 1/`positions` of each cycle, and with
// one position is a Square.
export function intensityScale(
  { shape, depth, length }: IntensityEffect,
  beat: number,
  delay: number,
  positions: number,
): number {
  return 1 - depth * (1 - fullLevel(shape, cyclePhase(length, beat, delay), positions));
}

// An intensity Effect's level at full depth, `phase` into its cycle.
function fullLevel(shape: IntensityShape, phase: number, positions: number): number {
  const lit = (share: number) => (phase < share ? 1 : 0);
  switch (shape) {
    case 'Pulse':
      return (1 + Math.cos(2 * Math.PI * phase)) / 2;
    case 'Ramp up':
      return phase;
    case 'Ramp down':
      return 1 - phase;
    case 'Square':
      return lit(1 / 2);
    case 'Chase':
      return lit(positions > 1 ? 1 / positions : 1 / 2);
  }
}

// A colour `p` (0–1) of the way from `from` to `to`.
export interface ColourMix {
  from: Colour;
  to: Colour;
  p: number;
}

// The colours a colour Effect mixes at `beat`. `delay` is as for
// `effectTurn`. A Step holds each colour for an equal share of the cycle; a
// Fade spends that share fading to the next, the last back to the first.
export function colourEffectMix(effect: ColourEffect, beat: number, delay: number): ColourMix {
  const phase = cyclePhase(effect.length, beat, delay);
  if (effect.shape === 'Rainbow') {
    const hue = { hue: phase * 360, saturation: 1 };
    return { from: hue, to: hue, p: 0 };
  }
  const { colours } = effect;
  const at = phase * colours.length;
  const index = Math.floor(at);
  const from = colours[index]!;
  if (effect.shape === 'Step') return { from, to: from, p: 0 };
  return { from, to: colours[(index + 1) % colours.length]!, p: at - index };
}

// How far into its cycle an Effect of `length` beats is at `beat`, `delay`
// of a cycle behind, 0 to under 1.
function cyclePhase(length: number, beat: number, delay: number): number {
  return (((beat / length - delay) % 1) + 1) % 1;
}

// How many distinct delays a Spread gives the targeted Fixtures.
export function spreadPositions(spread: Spread, targeted: StagePosition[]): number {
  return new Set(targeted.map((fixture) => spreadDelay(spread, fixture, targeted))).size;
}

// How far behind the cycle a Fixture runs under a Spread, 0–1, among the
// Fixtures the Effect targets, ordered by stage x: Left→Right from the lowest
// x, Mirrored from the lowest |x| (centre out), Alternate every other one.
// Fixtures at the same place in the order run together.
export function spreadDelay(
  spread: Spread,
  fixture: StagePosition,
  targeted: StagePosition[],
): number {
  if (spread === 'In sync') return 0;
  const key = ({ x }: StagePosition) => (spread === 'Mirrored' ? Math.abs(x) : x);
  const keys = [...new Set(targeted.map(key))].sort((a, b) => a - b);
  const rank = keys.indexOf(key(fixture));
  if (rank < 0) return 0;
  return spread === 'Alternate' ? (rank % 2) / 2 : rank / keys.length;
}

// `count` numbers 0–1, the same each time for `id`.
function seeded(id: string, count: number): number[] {
  // FNV-1a, then a xorshift for each number.
  let state = 0x811c9dc5;
  for (const char of id) state = Math.imul(state ^ char.charCodeAt(0), 0x01000193);
  return Array.from({ length: count }, () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  });
}
