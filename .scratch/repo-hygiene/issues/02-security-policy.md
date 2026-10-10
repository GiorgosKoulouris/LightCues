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

## Comments

2026-10-09 (from `public-face/02`): the README's Links section has an HTML comment for `SECURITY.md`. Replace it with the link.

2026-10-10: agent part done. `SECURITY.md` at the root: latest release only, report through the Security tab's **Report a vulnerability**, no email, acknowledgement within 7 days, best effort, one maintainer, fixes listed under Security in CHANGELOG.md. The README Links comment is replaced with the link. CONTRIBUTING.md links `SECURITY.md` instead of repeating the steps. No promise on advisory publishing or credit: not decided in the spec. No changelog line: docs only. `npm run format:check` passes. Left for the maintainer: enable **Private vulnerability reporting** (Settings > Code security), then check the Security tab shows the policy and the button.
