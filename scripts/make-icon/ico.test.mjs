import { describe, expect, it } from 'vitest';
import { encodeIco } from './ico.mjs';

// Fake PNG payloads: the encoder stores them as given.
const png = (size, length) => ({ size, data: Buffer.alloc(length, size % 256) });

describe('encodeIco', () => {
  it('writes the ICONDIR header with the image count', () => {
    const ico = encodeIco([png(16, 10), png(32, 20)]);
    expect(ico.readUInt16LE(0)).toBe(0); // reserved
    expect(ico.readUInt16LE(2)).toBe(1); // type: icon
    expect(ico.readUInt16LE(4)).toBe(2); // count
  });

  it('writes one 16-byte directory entry per image', () => {
    const ico = encodeIco([png(16, 10), png(48, 30)]);
    const second = 6 + 16;
    expect(ico.readUInt8(second)).toBe(48); // width
    expect(ico.readUInt8(second + 1)).toBe(48); // height
    expect(ico.readUInt16LE(second + 4)).toBe(1); // planes
    expect(ico.readUInt16LE(second + 6)).toBe(32); // bits per pixel
    expect(ico.readUInt32LE(second + 8)).toBe(30); // data length
  });

  it('stores 256 px as 0 in the width and height bytes', () => {
    const ico = encodeIco([png(256, 5)]);
    expect(ico.readUInt8(6)).toBe(0);
    expect(ico.readUInt8(7)).toBe(0);
  });

  it('places each image after the directory, at its recorded offset', () => {
    const images = [png(16, 10), png(32, 20)];
    const ico = encodeIco(images);
    const headerLength = 6 + 16 * images.length;
    images.forEach((image, index) => {
      const entry = 6 + 16 * index;
      const offset = ico.readUInt32LE(entry + 12);
      const length = ico.readUInt32LE(entry + 8);
      expect(ico.subarray(offset, offset + length)).toEqual(image.data);
    });
    expect(ico.readUInt32LE(6 + 12)).toBe(headerLength);
    expect(ico.length).toBe(headerLength + 30);
  });

  it('rejects sizes an icon cannot hold', () => {
    expect(() => encodeIco([png(512, 1)])).toThrow(/512/);
  });

  it('rejects an empty image list', () => {
    expect(() => encodeIco([])).toThrow(/at least one/);
  });
});
