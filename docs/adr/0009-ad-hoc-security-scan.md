# Ad hoc security scan of a pinned ref, triaged by Claude

Security scanning is an ad hoc local flow, not a CI gate. A script builds the app from a clean worktree of a given ref (default `HEAD`), extracts `app.asar`, and runs osv-scanner and semgrep, plus a check against the Electron releases feed. Claude then triages the raw output, reviews the Electron security surface, and writes one Markdown report. Packages count as "ships" when they are found in the built app, not by the dependency/devDependency flag, because Electron and React are devDependencies that ship. The flow is report-only and never changes the repo. Reports are gitignored because the repo is public and a report can name exploitable weaknesses.

## Considered Options

- A CI job with a severity threshold: catches regressions automatically, but noisy for a small app and a dev-only CVE would block releases. It could come later on top of the same script.
- `npm audit` only: no install needed, but one advisory source, no code scan, and blind to Chromium CVEs in Electron.
- Scanning the working tree: faster, but the report can't be tied to a commit and therefore to an installer.
- A mechanical merge of tool outputs without Claude: reproducible, but can't tell a reachable CVE from a test-only one, or review IPC and `webPreferences` in context.
- Electronegativity as the main Electron check: purpose-built, but mostly unmaintained upstream. Kept as an optional second opinion.
