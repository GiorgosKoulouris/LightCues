# README for musicians, docs/development.md for developers

Status: resolved

See spec, "Audience" and "README order".

## Fix

- `docs/development.md` (new): move Where to run what, the from-source Quickstart, Commands, CI, Security scan, Architecture and Contributing from the README. Fix the Quickstart:
  - Clone and build `main` (the released code). Working on `dev` is described under Contributing.
  - Replace "Engine replied in N ms" with what the window shows today. Check `src/renderer/` for the first-run state.
- `README.md`: rewrite in the spec's order. Short sentences, domain terms from `CONTEXT.md`. Link `docs/development.md` once, near the top ("Building from source").
- Contributing line in the README: "Bug reports and Fixture requests welcome as GitHub Issues. Pull requests by arrangement: open an issue first."
- Image placeholders where issue 03 will put screenshots: a comment, not a broken link.
- Update links that point at README sections: `docs/agents/*.md`, `docs/setup.md`, `.devcontainer/README.md`, `CLAUDE.md`, workflow comments. Search for `README.md#`.

## Acceptance

- No developer-only section left in the README.
- Every link in both files resolves (check relative links with a small script or by hand).
- Nothing in the README is stale: each claim checked against the code (file names, menu labels, folder paths, supported hardware).
- `npm run format:check` passes.

## Implemented (2026-10-09)

- `docs/development.md` (new) holds Where to run what, Quickstart from source, Commands, CI, Security scan, Architecture and Contributing. The Quickstart builds `main`. The first-run check is the top bar's green dot and "Engine". The window opens on Venue Patch.
- `README.md` follows the spec's order. Each label, path, key and behaviour was checked against `src/`.
- `docs/setup.md` §6 had the same stale Quickstart. Fixed there too. Its Commands link and the CI link in `docs/agents/staging.md` now point at `docs/development.md`.
- `npm run icon` added to Commands. It was missing.

Choices beyond the issue:

- `docs/development.md` is linked once, near the top, as this issue says. Spec item 7 also lists it under Links. This issue wins.
- Install says "By default it installs for your user only". The NSIS installer is assisted (`oneClick: false`), so a user can pick per-machine.

HTML comments are placeholders, not links:

- Hero screenshot, Profile import, Venue Patch stage plan, Scene/Rule editor, demo GIF: issue 03.
- "Open the example" at the top of First Show: `try-without-hardware/03`.
- `SECURITY.md` under Links: `repo-hygiene/02`.
