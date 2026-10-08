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

Squash `dev` into 4-5 commits on a `stage` branch before merging to `main`. No AI co-author trailers in staged commits. See `docs/agents/staging.md`.
