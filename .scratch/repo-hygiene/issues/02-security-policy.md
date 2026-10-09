# SECURITY.md and private vulnerability reporting

Status: ready-for-human

See spec, "Decisions". The file is agent work. The GitHub setting is yours.

## Fix

- `SECURITY.md` (new, repo root): supported versions (latest release only), how to report (GitHub → Security → Report a vulnerability), what to expect (acknowledgement within 7 days, best effort, single maintainer). Plain wording, short.
- GitHub settings → Code security → enable **Private vulnerability reporting**.
- README: link `SECURITY.md` from the License/Contributing area.

## Acceptance

- The Security tab shows the policy and the "Report a vulnerability" button.
- `npm run format:check` passes.
