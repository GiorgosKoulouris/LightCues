# CHANGELOG.md as the release body

Status: resolved

See spec, "Changelog".

## Fix

- `CHANGELOG.md` (new): header, `## [Unreleased]`, and a backfilled `## [0.1.0]` plus `## [0.1.1]` if it was released. Read `git log v0.1.0` and the tags to write them. User terms from `CONTEXT.md`.
- `scripts/changelog-section.mjs` (new): prints the section for a version, exits non-zero if missing or empty. Small and tested.
- `.github/workflows/release.yml`: run the script into a file, pass `--notes-file` instead of `--generate-notes`.
- `.github/workflows/ci.yml`: on push, warn (`::warning::`) if the version has no section.
- `docs/agents/releasing.md` and `docs/agents/staging.md`: when the batch bumps the version, move `[Unreleased]` under the new version heading in the same batch. Say every user-facing change adds a changelog line on `dev`.
- ADR 0006: add one line, or a new ADR if it reads better: release notes come from the changelog.

## Acceptance

- Tests for the script: finds a section, stops at the next `## [`, fails on missing and empty.
- A dry run of the release step's script in the devcontainer prints the right body for `0.1.1`.
- `npm run check` passes.

Choices beyond the issue:

- 0.1.1 is not released (main is at v0.1.0), but `package.json` on `dev` is already 0.1.1. So the dev work since v0.1.0 sits under `## [0.1.1] - 2026-10-09` and `[Unreleased]` is empty. When this batch is staged as 0.1.1, set the date to the staging day.
- Script logic in `scripts/changelog-section/section.mjs` with tests beside it, CLI in `scripts/changelog-section.mjs`, like `make-icon`. The version is a required argument. A section with only `###` headings counts as empty. Headings with or without a date match; `0.1.1` never matches `0.1.10`.
- The release step runs before `npm ci`, so a missing section fails in seconds. Both workflow steps pass the version through `env:`.
- `docs/agents/releasing.md` has a new "Changelog" section: user-facing changes add a line on `dev` in the same commit; internal work adds none. `docs/development.md` CI table and Contributing list updated too.
- ADR 0006 got one paragraph, not a new ADR.

Dry run in the devcontainer: `node scripts/changelog-section.mjs 0.1.1 > "$RUNNER_TEMP/notes.md"` writes the 0.1.1 body (29 lines). `9.9.9` exits 1 with `CHANGELOG.md: No section for 9.9.9.` Not checked: a real tag run on GitHub. The first release (0.1.1) will show it.

### 2026-10-09: resolved

All acceptance checks pass. `npm run check` passes (913 tests).
