# Release flow and user feedback

Batch 6 of the 2026-10-09 repo plan.

`release.yml` publishes with `gh release create --generate-notes`. With squashed batches and no PRs, the generated notes say almost nothing. Users have no way to report a bug: issues live in local `.scratch/` files.

## Scope

1. `CHANGELOG.md`, used as the release body (issue 01).
2. GitHub Issues for users, with templates, and `CONTRIBUTING.md` (issue 02).
3. A "Copy diagnostics" button for bug reports (issue 03).

## Decisions (2026-10-09)

### Changelog

- `CHANGELOG.md` in Keep a Changelog format. Sections Added, Changed, Fixed, Security. Written for users, not developers.
- Work on `dev` adds lines under `## [Unreleased]`. Staging moves them under `## [X.Y.Z] - YYYY-MM-DD` when the batch bumps the version. Which batch becomes a release is the maintainer's call (no version per plan batch).
- `release.yml` takes the `## [X.Y.Z]` section as the release body (`--notes-file`) instead of `--generate-notes`. It fails if the section is missing or empty.
- CI on `stage` and `main` warns when `package.json`'s version has no changelog section yet. A warning only: `stage` can hold a non-release batch.
- Backfill: one `## [0.1.0]` entry summarising the first release, plus what's on `main` since.

### User feedback

- GitHub Issues on, for users. Templates: Bug report and Fixture/Profile request. Blank issues off. A config link to `SECURITY.md` for vulnerabilities.
- `.scratch/` stays the maintainer's spec and issue tracker. A GitHub Issue that turns into work gets a `.scratch/` issue that links back to it.
- `CONTRIBUTING.md`: issues welcome, pull requests by arrangement, how the `dev`/`stage`/`main` flow works in two lines, with a link to `docs/development.md`.

### Diagnostics

- A "Copy diagnostics" item in the app copies plain text: app version, Electron version, Windows version, Outputs and their state, MIDI ports and the selected one, Tempo source, the log folder path. No document contents, no file paths except the log folder.

## Order

Any order. 03 is referenced from 02's bug template, so if 02 lands first, its template says "if your version has it".
