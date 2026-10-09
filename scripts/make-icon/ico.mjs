// Packs PNG images into a Windows .ico file. Each entry holds the PNG as is,
// which Windows Vista and later read at every size.

const HEADER_LENGTH = 6;
const ENTRY_LENGTH = 16;

// Takes square PNGs of 1–256 px as { size, data } and returns the .ico bytes.
export function encodeIco(images) {
  if (images.length === 0) throw new Error('An icon needs at least one image');
  for (const { size } of images) {
    if (!Number.isInteger(size) || size < 1 || size > 256) {
      throw new Error(`Icon images must be 1–256 px, got ${size}`);
    }
  }

  const directory = Buffer.alloc(HEADER_LENGTH + ENTRY_LENGTH * images.length);
  directory.writeUInt16LE(0, 0); // reserved
  directory.writeUInt16LE(1, 2); // type: icon
  directory.writeUInt16LE(images.length, 4);

  let offset = directory.length;
  images.forEach(({ size, data }, index) => {
    const entry = HEADER_LENGTH + ENTRY_LENGTH * index;
    const dimension = size === 256 ? 0 : size; // 0 means 256
    directory.writeUInt8(dimension, entry); // width
    directory.writeUInt8(dimension, entry + 1); // height
    directory.writeUInt8(0, entry + 2); // palette colors
    directory.writeUInt8(0, entry + 3); // reserved
    directory.writeUInt16LE(1, entry + 4); // color planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(data.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });

  return Buffer.concat([directory, ...images.map(({ data }) => data)]);
}
