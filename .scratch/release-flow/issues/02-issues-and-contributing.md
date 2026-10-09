# GitHub Issues templates and CONTRIBUTING.md

Status: ready-for-human

See spec, "User feedback". The files are agent work. Turning on Issues is yours.

## Fix

- `.github/ISSUE_TEMPLATE/bug.yml`: issue form with fields LightCues version, Windows version, DMX interface, MIDI setup, Fixtures involved, what happened, what you expected, steps, diagnostics (paste from "Copy diagnostics"), log excerpt (optional). Label `needs-triage`.
- `.github/ISSUE_TEMPLATE/fixture-request.yml`: manufacturer, model, mode, link to OFL/GDTF Share or manual, what fails (import error, wrong channels, missing feature). Label `needs-triage`.
- `.github/ISSUE_TEMPLATE/config.yml`: `blank_issues_enabled: false`, a contact link "Security vulnerability" → the repo's Security tab.
- `CONTRIBUTING.md` (new): as in the spec.
- GitHub → Settings → Features: enable Issues. Create the labels from `docs/agents/triage-labels.md`.
- `docs/agents/issue-tracker.md`: a short section on how a GitHub Issue becomes a `.scratch/` issue (link both ways).

## Acceptance

- New issue on GitHub offers the two templates and the security link, no blank issue.
- `npm run format:check` passes.
