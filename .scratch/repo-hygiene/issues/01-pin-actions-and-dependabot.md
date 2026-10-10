# Pin actions by SHA and add Dependabot

Status: ready-for-human

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

## Comments

2026-10-10: agent part done. Actions pinned to the latest releases: checkout v7.0.1, setup-node v7.1.0, upload-artifact v7.0.2 (from v5). The v6/v7 breaking changes (`pull_request_target` checkout block, setup-node auto-cache, Node 24 runtime, ESM) don't touch these workflows. `.github/dependabot.yml` as specified. README has no CI section, so the Dependabot notes went to `docs/development.md` § Dependabot. `staging.md` step 1 checks for open Dependabot PRs. Security-update PRs always target `main`, not `dev`; recorded in the spec's Decisions. No changelog line: not user-facing. `npm run check` passes. Left for the maintainer: push, check GitHub shows no Dependabot config error (Insights > Dependency graph > Dependabot), and turn on Dependabot alerts and security updates in Settings > Code security. The first `stage`/`main` CI run checks the v7 actions on Windows.

2026-10-10: maintainer turned on alerts and security updates. Left: push `dev` (Dependabot's `target-branch`, not on the remote yet), then check the Dependabot config shows no error.
