# Ship third-party notices in the installer

Status: ready-for-human

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

2026-10-10 (agent): implemented. Left for you: the Windows acceptance check. Run `npm run package` on Windows, install, and check `resources/THIRD_PARTY_NOTICES.txt` lists `react`, `serialport` and `fast-xml-parser`. Then mark resolved. Verified here: `npm run check` passes; `electron-builder --win --dir` writes the file into `dist/win-unpacked/resources` (76 packages: 74 MIT, 1 ISC, 1 0BSD, plus the Open Fixture Library credit). NSIS needs Wine, which the devcontainer lacks.

Departures from the Fix list:

- **afterPack hook, not a `package` step + `extraResources`.** The scan's inventory reads the packed `app.asar`, which only exists once electron-builder has packed the app. `scripts/third-party-notices.mjs` is electron-builder's `afterPack` hook. It runs after `extraResources` and before NSIS, and writes `resources/THIRD_PARTY_NOTICES.txt` straight into the packed app. So no `out/` file and no `extraResources` entry. `package.json` scripts are unchanged.
- **Bundled packages in the inventory.** A Vite plugin (`scripts/bundled-packages.mjs`) writes `out/*/bundled-packages.json`, and `buildInventory` counts those packages as shipped (`bundled: true`). This also closes the scan's "renderer-bundled packages" triage gap. The scan docs are updated.
- **Allow list = the scan's list.** It moved from prose in `docs/agents/security-scan.md` to `scripts/security-scan/licenses.mjs`. It covers the issue's list plus Zlib, MPL-2.0, LGPL, GPL-3.0, Python-2.0 and BlueOak-1.0.0, all GPL-3.0 compatible. The scan's `licenses.json` rows get `allowed`.
- **Fallback license copies.** `@nodable/entities@3.1.0` and `react-remove-scroll-bar@2.3.8` ship without a license file. Upstream copies are in `build/licenses/<name>@<version>.txt` (nodable/val-parsers and theKashey/react-remove-scroll-bar LICENSE, both MIT). They are keyed by version, so an update fails again until checked. The notices label them "upstream copy".
- **The scan skips the hook** (`LIGHTCUES_SKIP_NOTICES=1`), so a license problem shows in the report instead of aborting the scan (ADR 0009). Note: notices read `package.json` `license`, while the scan reads osv-scanner's licenses. The list is shared, but the two inputs can disagree.
- Tests use temp-dir fixtures like `inventory.test.mjs`, not `testdata/` files.
- About / Licenses entry: not done, filed as issue 05.

