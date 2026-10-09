// Renders build/icon.svg to build/icon.ico at the sizes Windows uses.
// The .ico is committed, so packaging doesn't need this script.
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { encodeIco } from './make-icon/ico.mjs';

const SIZES = [16, 24, 32, 48, 64, 128, 256];
const source = new URL('../build/icon.svg', import.meta.url);
const target = new URL('../build/icon.ico', import.meta.url);

const svg = readFileSync(source);
const images = SIZES.map((size) => ({
  size,
  data: new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng(),
}));
writeFileSync(target, encodeIco(images));
console.log(`Wrote build/icon.ico (${SIZES.join(', ')} px)`);
