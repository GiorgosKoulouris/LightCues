// A GDTF colour (CIE 1931 `x,y,Y`) as '#rrggbb' in sRGB (D65). Y is dropped:
// the colour is scaled to full brightness, so a dense filter still shows its
// hue. Out-of-gamut colours are clipped. White when missing or unreadable.
export function cieToHex(text: string | undefined): string {
  const [x, y] = (text ?? '').split(',').map(Number);
  if (x === undefined || y === undefined || !(x >= 0) || !(y > 0)) return '#ffffff';
  // XYZ at Y = 1.
  const X = x / y;
  const Z = (1 - x - y) / y;
  const linear = [
    3.2404542 * X - 1.5371385 - 0.4985314 * Z,
    -0.969266 * X + 1.8760108 + 0.041556 * Z,
    0.0556434 * X - 0.2040259 + 1.0572252 * Z,
  ].map((c) => Math.max(0, c));
  const max = Math.max(...linear);
  if (max === 0) return '#ffffff';
  return `#${linear.map((c) => hexByte(gamma(c / max))).join('')}`;
}

// sRGB transfer function.
function gamma(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function hexByte(c: number): string {
  return Math.round(c * 255)
    .toString(16)
    .padStart(2, '0');
}
