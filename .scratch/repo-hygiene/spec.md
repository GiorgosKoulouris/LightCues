# Repo hygiene

Batch 2 of the 2026-10-09 repo plan. Small, mostly settings and config.

The repo is public and ships an installer. CI actions are pinned by tag only. Dependencies are checked only when the ad hoc security scan runs. There is no way to report a vulnerability privately. `main` and `v*` tags have no protection. The installer ships `LICENSE` but no notices for the MIT/ISC/BSD packages bundled into it.

## Scope

1. Pin actions by SHA, and add Dependabot (issue 01).
2. `SECURITY.md` and private vulnerability reporting (issue 02).
3. Rulesets for `main` and `v*` tags (issue 03).
4. A third-party notices file in the installer (issue 04).
5. A Licenses entry in the app (issue 05, from 04).
6. Rulesets for `dev` and `stage` (issue 06, from 03).

Out of scope: CodeQL (semgrep with the custom Electron rules covers it), scanning in CI. The security scan stays ad hoc (ADR 0009).

## Decisions (2026-10-09)

- Actions: `actions/checkout`, `actions/setup-node`, `actions/upload-artifact`, pinned to full commit SHAs with the version in a trailing comment.
- Dependabot: `npm` and `github-actions`, monthly. npm updates grouped into one PR for dev dependencies and one for runtime dependencies. Security updates stay on, ungrouped. PRs target `dev`. There's no CI on `dev`, so merging is manual after `npm run check`. `dev` is force-pushed after staging (`docs/agents/staging.md` step 10), so pull `dev` after merging a Dependabot PR, and merge open Dependabot PRs before a staging round. Add that note to `staging.md`. Not `main`: a merge there would break the fast-forward from `stage`.
- Security updates (2026-10-10, found in issue 01): GitHub opens them against the default branch whatever `target-branch` says. Don't merge them on `main`. Apply the bump on `dev`, close the PR. Written in `docs/development.md` § Dependabot.
- `SECURITY.md`: supported versions are only the latest release. Report through GitHub private vulnerability reporting. No email.
- Rulesets: `main` gets no force push, no deletion, and status checks required for PRs. `v*` tags: only the owner can create them, and no updating or deleting them.
- Rulesets for `dev` and `stage` (2026-10-10): no force push, no deletion, with Repository admin on the bypass list. The staging flow force-pushes both and deletes `stage`.
- Notices: generated at package time from what ships in the app (the same inventory the security scan uses), not hand-written.

## Order

Any order. 04 is the only code change.
