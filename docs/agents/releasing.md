# Releasing: tag a version on `main`

A release is a `vX.Y.Z` tag on a commit on `main`. Pushing the tag runs [release.yml](../../.github/workflows/release.yml). It builds the installer from the tagged commit and publishes a GitHub Release. See [ADR 0006](../adr/0006-tag-driven-releases.md).

Not every merge is a release. A docs-only batch goes to `main` untagged.

## Changelog

[CHANGELOG.md](../../CHANGELOG.md) is the release notes, written for users in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format: Added, Changed, Fixed, Security. Use the terms in [CONTEXT.md](../../CONTEXT.md).

Every user-facing change adds a line under `## [Unreleased]` on `dev`, in the same commit as the change. Internal work (tests, CI, docs for developers, the issue tracker) adds none.

## Flow

1. **Bump the version in the staged batch.** On `dev`, set `version` in `package.json` (and `package-lock.json`):
   ```sh
   npm version 0.2.0 --no-git-tag-version
   ```
   In the same commit, move everything under `## [Unreleased]` in [CHANGELOG.md](../../CHANGELOG.md) to a new `## [0.2.0] - YYYY-MM-DD` heading, dated the day of staging. Leave `## [Unreleased]` empty above it. Commit both. They are squashed into the batch with the rest (see [staging.md](staging.md)).
2. **Stage and merge** as usual. CI on `stage` checks the version is valid semver, and warns if it has no changelog section.
3. **Suggested: run the security scan** on the merged commit. Advice, not a gate. See [security-scan.md](../security-scan.md).
   ```sh
   git checkout main && git pull
   npm run security:scan -- --ref main     # or ask Claude to "run the security scan on main"
   ```
4. **Tag the merged commit and push the tag.**
   ```sh
   git checkout main && git pull
   git tag v0.2.0
   git push origin v0.2.0
   ```
5. **Check the GitHub Release.** Wait for the release run to go green. The GitHub Release lists `LightCues-Setup-0.2.0.exe`, `LightCues-Setup-0.2.0.exe.blockmap` and `latest.yml`. Its body is the `## [0.2.0]` section of CHANGELOG.md.

## Rules the release run enforces

- **The tag equals `v` + the `package.json` version.** A clone at the tag must build the same version as the download. A mismatch fails the run before anything is built.
- **The tagged commit is on `main`.** A tag on `dev` or `stage` fails.
- **Built from the tag.** The run checks and packages the tagged commit itself. It never reuses an installer from a `main` run.
- **The version has a changelog section.** `node scripts/changelog-section.mjs 0.2.0` prints the release body. A missing or empty section fails the run before anything is built. Try it locally before tagging.
- **Suffix means prerelease.** `v0.3.0-rc.1` is published as a prerelease.

If a run fails, nothing is published. Fix the cause, then move the tag:

```sh
git tag -d v0.2.0 && git push origin :refs/tags/v0.2.0
# fix, merge, then tag again
```

If the GitHub Release was already published, delete it on GitHub before re-tagging, or bump to the next version.

## Untagged code on `main`

Every push to `main` also runs CI: check, e2e, package, and an installer artifact kept 7 days. If HEAD has no `v*` tag and files outside `docs/`, `.scratch/`, `.github/` and `*.md` changed since the last tag, the run shows a warning. It does not fail: the tag usually lands a few minutes after the merge. A warning that stays means a release was forgotten.

Until the first `v*` tag exists, every push to `main` warns, docs-only ones too.

## Not yet

- No code signing. Windows SmartScreen warns on install.
- No auto-update. The app only checks for a newer release and links to it (ADR 0012). `latest.yml` and the blockmap are published so an updater can be added later. Code signing must come first.
