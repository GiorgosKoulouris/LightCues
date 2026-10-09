# Releases are driven by tags that match package.json

A release is a `vX.Y.Z` tag on a commit on `main`. CI builds the installer from that commit and publishes it to a GitHub Release, with `latest.yml` and the blockmap for a future auto-updater. The tag must equal `v` + the `package.json` version, or the release fails. This way a clone at the tag builds the same version as the download. Not every push to `main` is a release: doc-only changes go in untagged. CI warns, but doesn't fail, when code changes since the last tag sit on `main` untagged.

The release notes are the version's section of `CHANGELOG.md`, written for users and kept on `dev` as changes land. GitHub's generated notes said almost nothing: batches are squashed and there are no PRs. A missing or empty section fails the release.

## Considered Options

- Every push to `main` is a release, versioned from `package.json`, tagged by CI: no drift, but even a doc fix needs a version bump.
- The tag writes the version into `package.json` at build time: one less manual step, but a clone of the tag builds a different version than the download.
- Releases as workflow artifacts: no Release page, they expire, and an updater can't find them.
