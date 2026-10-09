# Pin actions by SHA and add Dependabot

Status: ready-for-agent

See spec, "Decisions".

## Problem

`ci.yml` and `release.yml` use `actions/*@v5` tags. A moved tag runs new code with `contents: write` in the release job. Dependencies are only checked when someone runs the security scan.

## Fix

- `.github/workflows/ci.yml`, `.github/workflows/release.yml`: replace each `uses: owner/action@vN` with `uses: owner/action@<40-char SHA> # vN.x.y`. Look up the SHA of the current latest release of each.
- `.github/dependabot.yml` (new): `npm` and `github-actions`, `interval: monthly`, `target-branch: dev`. Groups: `dev-dependencies` (dependency-type development) and `runtime` (dependency-type production). Respect the `overrides` in `package.json`: no ignore needed, but say in the file's comment that `global-agent` is pinned by an override.
- `README.md` CI section: one line on Dependabot.

## Acceptance

- No `uses:` line without a 40-character SHA.
- `dependabot.yml` validates (GitHub shows no config error after push).
- `npm run check` passes.
