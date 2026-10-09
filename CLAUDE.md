## User preferences and rules

### Output style

- Keep responses compact and technical.
- Use short sentences and plain wording. No filler or flourish.

### Branching

- Make all modifications on the `dev` branch. Create it if it doesn't exist.
- Before starting, check `dev` for pending work (uncommitted changes). If there is any, ask the user how to proceed. You can proceed without asking if dev is not yet merged to main, this is OK.

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage roles (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Staging

Squash `dev` into 4-5 commits on a `stage` branch before merging to `main`, optionally holding back commits that stay on `dev`, or reordering `dev`. No AI co-author trailers in staged commits. Follow `docs/agents/staging.md` for every staging, squash or reorder request.

### Releasing

A release is a `vX.Y.Z` tag on `main` that equals `v` + the `package.json` version. Bump the version in the staged batch, merge, then tag by hand. See `docs/agents/releasing.md`.

### Security scan

When asked to "run the security scan", run `npm run security:scan`, triage its outputs, review the code and write a report to `reports/security/`. Report-only: change and commit nothing. Follow `docs/agents/security-scan.md`.
