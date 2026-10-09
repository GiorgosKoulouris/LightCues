# README for musicians, docs/development.md for developers

Status: ready-for-agent

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
