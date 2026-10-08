# Distribution

Get LightCues to operators without a dev setup, and check every change automatically.

Today `npm run build` only writes to `out/`. Running the app needs a clone, Node and C++ build tools. There is no CI.

## Scope

- A Windows installer built from the repo (issue 01).
- CI that runs `npm run check` and builds the installer (issue 02).

## Constraints

- Windows x64 only.
- Native modules (`serialport`, `@julusian/midi`) use N-API prebuilds. The packaged app must include the win32-x64 binaries.
- GPL-3.0-only. Release artifacts must point to the source.
