# Ship third-party notices in the installer

Status: ready-for-agent

See spec, "Decisions".

## Problem

The installer bundles React, serialport, @julusian/midi, fflate, fast-xml-parser, Radix, lucide and more. MIT, ISC and BSD require their copyright notice and license text to go with copies. Only LightCues' own `LICENSE` ships today. Electron ships its own `LICENSES.chromium.html`.

## Fix

- `scripts/third-party-notices.mjs` (new): lists the npm packages that ship. That is the runtime `dependencies` tree, plus the devDependencies bundled into `out/` by Vite (React, Radix, lucide, dnd-kit, …). Reuse `scripts/security-scan/inventory.mjs` if it fits, so "what ships" has one definition. For each package, write its name, version, license id and the full text of its LICENSE/COPYING/NOTICE file into `THIRD_PARTY_NOTICES.txt`.
- Fail if a shipped package has no license file, or has a license that is not on an allow list (MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, CC0-1.0, Unlicense). The scan's license check already uses an allow list: share it.
- `package.json`: run the script in `package` before `electron-builder`. Output to `out/THIRD_PARTY_NOTICES.txt` (gitignored).
- `electron-builder.yml`: add it to `extraResources`, next to `LICENSE.txt`.
- Optional: an "About / Licenses" entry in the app that opens the file. A later issue if not done here.

## Acceptance

- Tests for the script with `scripts/security-scan/testdata`-style fixtures: a package's license text is included, a package with no license file fails, a disallowed license fails.
- After `npm run package` on Windows: `resources/THIRD_PARTY_NOTICES.txt` is in the install folder and lists `react`, `serialport` and `fast-xml-parser`.
- `npm run check` passes.

## Comments

2026-10-09 (from `try-without-hardware/03`): the example Venue Patch embeds Profiles imported from Open Fixture Library fixture data (MIT, Copyright (c) 2017 Florian & Felix Edelmann). Credit it in `THIRD_PARTY_NOTICES.txt` too. `examples/README.md` has the license text.
