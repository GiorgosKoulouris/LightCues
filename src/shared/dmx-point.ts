// A point on a channel's DMX range, and its DMX value at 8 or 16 bits.

// A point `t` (0–1) of the way across the DMX values `from`–`to`.
export interface Point {
  from: number;
  to: number;
  t: number;
}

export const fixed = (value: number): Point => ({ from: value, to: value, t: 0 });

// The DMX value of a point: 8-bit, or 16-bit when the channel has a fine
// channel, `to` then spanning its whole fine range.
export function toDmx({ from, to, t }: Point, fine: boolean): number {
  if (!fine) return Math.round(from + (to - from) * t);
  return Math.round(from * 256 + (to * 256 + 255 - from * 256) * t);
}

// One byte of a 16-bit DMX value: 0 for the control channel, 1 for its fine
// channel. A 24-bit channel's lowest byte (2) is 0.
export function dmxByte(value: number, byte: number): number {
  return byte === 0 ? value >> 8 : byte === 1 ? value & 0xff : 0;
}
