# CHANGELOG.md as the release body

Status: ready-for-agent

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
