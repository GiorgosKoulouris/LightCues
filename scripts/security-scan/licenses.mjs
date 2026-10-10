// The licenses a shipped package may have: compatible with GPL-3.0-only, the
// app's license. Shared by the scan's license check and the third-party
// notices (scripts/third-party-notices.mjs). GPL-2.0-only is not compatible.
export const ALLOWED_LICENSES = [
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'ISC',
  'LGPL-2.1-only',
  'LGPL-2.1-or-later',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'MIT',
  'MPL-2.0',
  'Python-2.0',
  'Unlicense',
  'Zlib',
];

// An SPDX expression like `MIT`, `(MIT OR Apache-2.0)` or `MIT AND ISC`. OR
// needs one allowed side, AND both. Anything else (WITH, a typo, a file
// reference) is not allowed.
export function isAllowedLicense(expression) {
  const tokens = expression.match(/\(|\)|[^\s()]+/g) ?? [];
  let i = 0;
  const parseOr = () => {
    let allowed = parseAnd();
    while (tokens[i] === 'OR') {
      i++;
      allowed = parseAnd() || allowed;
    }
    return allowed;
  };
  const parseAnd = () => {
    let allowed = parseAtom();
    while (tokens[i] === 'AND') {
      i++;
      allowed = parseAtom() && allowed;
    }
    return allowed;
  };
  const parseAtom = () => {
    const token = tokens[i++];
    if (token !== '(') return ALLOWED_LICENSES.includes(token);
    const allowed = parseOr();
    if (tokens[i++] !== ')') i = Infinity;
    return allowed;
  };
  const allowed = parseOr();
  return i === tokens.length && allowed;
}
