// How a Fixture's channels strobe. Shared because the engine drives them and
// the Venue Check reports what it can only approximate.
import type { CapabilityRange, Channel, Span } from './fixture-profile';
import { STROBE_HZ, type StrobeRate } from './show';

// The rate span taken for a strobe range, or strobe speed range, without one:
// slow to fast across its DMX range.
export const ASSUMED_STROBE_HZ: Span = [1, 20];

// A strobe rate in Hz at `bpm`; 0 for Off. A Fixture's own clock times the
// flashes, so they are not locked to the beat (ADR 0014).
export function strobeHz(rate: StrobeRate, bpm: number): number {
  if (rate === 'Off') return 0;
  return typeof rate === 'number' ? bpm / 60 / rate : STROBE_HZ[rate];
}

// What strobing sets on one channel: the rate across `ranges`, `assumed` when
// none gives its Hz span or a span is made from words; or `range`, which turns
// strobe on while another channel sets the rate.
export type StrobeDrive =
  | { kind: 'rate'; ranges: CapabilityRange[]; assumed: boolean }
  | { kind: 'on'; range: CapabilityRange };

// What strobing sets on each channel of a mode, by channel name; none for a
// Fixture without a strobe channel. Every strobe channel is driven. A strobe
// speed channel takes the rate when the strobe range is on another channel;
// that strobe range then only turns strobe on, unless it gives its own span.
export function strobeDrives(channels: Channel[]): Map<string, StrobeDrive> {
  const control = channels.flatMap((c) => (c.kind === 'control' ? [c] : []));
  const of = (type: 'strobe' | 'strobeSpeed', ranges: CapabilityRange[]) =>
    ranges.filter((r) => r.capability.type === type);
  const speedElsewhere = (name: string) =>
    control.some((c) => c.name !== name && of('strobeSpeed', c.ranges).length > 0);
  const drives = new Map<string, StrobeDrive>();
  for (const { name, ranges } of control) {
    const strobe = of('strobe', ranges);
    const own = strobe.length > 0 ? strobe : of('strobeSpeed', ranges);
    if (own.length === 0) continue;
    const rated = own.filter((r) => hzSpan(r) !== undefined);
    if (rated.length > 0) {
      const assumed = rated.some(({ capability: c }) => 'assumed' in c && c.assumed === true);
      drives.set(name, { kind: 'rate', ranges: rated, assumed });
    } else if (strobe.length > 0 && speedElsewhere(name))
      drives.set(name, { kind: 'on', range: strobe[0]! });
    else drives.set(name, { kind: 'rate', ranges: own, assumed: true });
  }
  return drives;
}

// A strobe or strobe speed range's Hz span, if it gives one.
export function hzSpan({ capability }: CapabilityRange): Span | undefined {
  return capability.type === 'strobe' || capability.type === 'strobeSpeed'
    ? capability.hz
    : undefined;
}
