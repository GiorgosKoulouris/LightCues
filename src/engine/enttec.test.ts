import { describe, expect, it } from 'vitest';
import { encodeSendDmx } from './enttec';

// Enttec DMX USB Pro API: 0x7E, label, data length (LSB, MSB), data, 0xE7.
// Label 6 (Output Only Send DMX) carries the DMX start code and then 24 to
// 512 channel values.
describe('encodeSendDmx', () => {
  it('frames the start code and channels as a label 6 message', () => {
    const channels = Uint8Array.from({ length: 512 }, (_, i) => i % 256);

    const message = encodeSendDmx(channels);

    expect(message.length).toBe(518);
    expect([...message.subarray(0, 5)]).toEqual([0x7e, 6, 0x01, 0x02, 0x00]);
    expect(message.subarray(5, 517)).toEqual(channels);
    expect(message[517]).toBe(0xe7);
  });

  it('pads fewer than 24 channels with zeros', () => {
    const message = encodeSendDmx(Uint8Array.of(255, 128, 1));

    expect([...message]).toEqual([
      0x7e,
      6,
      25,
      0,
      0,
      255,
      128,
      1,
      ...new Array<number>(21).fill(0),
      0xe7,
    ]);
  });

  it('rejects more than 512 channels', () => {
    expect(() => encodeSendDmx(new Uint8Array(513))).toThrow('at most 512 channels, not 513');
  });
});
