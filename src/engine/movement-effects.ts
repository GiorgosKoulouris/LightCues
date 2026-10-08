// Movement Effects: where a moving Fixture is turned from its base aim, in
// degrees, at a point in the Tempo's beat count. Pure.
import type { Turn } from '../shared/aim';
import type { MovementEffect, Spread } from '../shared/show';
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
