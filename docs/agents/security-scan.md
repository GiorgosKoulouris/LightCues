# Security scan: triage and report

When the user asks to "run the security scan", run the script, review its outputs and the code, and write one Markdown report. See [ADR 0009](../adr/0009-ad-hoc-security-scan.md).

The script collects. Claude triages. The report is the only output.

## Rules

- **Report-only.** Change nothing in the repo: no `npm audit fix`, no version bumps, no code fixes, no edits to `security/accepted.yml` or the semgrep rules. Fixes go through the normal issue flow. Suggest an issue, create it only when the user asks.
- **Nothing is committed.** `reports/` is gitignored. Reports can name exploitable weaknesses, and the repo is public. Never paste report contents into issues, commits or PRs.
- **Tool severity stays as the tool gave it.** Claude adds relevance, never rescales severity.
- **Every suggested fix is concrete:** a target version (`fast-xml-parser@5.12.0`) or a code change (`check folder is a string before join()`). Not "update the package" or "validate input".

## Flow

1. **Run the script** with the user's options. Default target is `HEAD`.
   ```sh
   npm run security:scan                            # HEAD, in a temp worktree
   npm run security:scan -- --ref <ref>             # any ref
   npm run security:scan -- --release v0.2.0        # a release tag
   npm run security:scan -- --working-tree          # local edits, marked dirty
   npm run security:scan -- --electronegativity     # add the second opinion
   npm run security:scan -- --keep-worktree         # keep the build for a closer look
   ```
   If it exits non-zero, stop. Report the error to the user. Don't triage partial output. A tool version mismatch means: rebuild the devcontainer.
2. **Find the output dir.** The summary line ends `Wrote <dir>`: `reports/security/<YYYY-MM-DD>-<shortsha>[-dirty]`. The report goes next to it, same name plus `.md`.
3. **Read the outputs** (see [Inputs](#inputs)).
4. **Review the code** with the [checklist](#review-checklist). Full review every run, not just the files with findings.
5. **Triage** each finding: relevance, reason, fix (see [Triage](#triage)).
6. **Diff** against the previous report (see [New since last report](#new-since-last-report)).
7. **Write the report** from the [template](#report-template). Give the user its path and the summary table.

## Inputs

All paths are inside the output dir.

| File                     | Content                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meta.json`              | `ref`, `sha`, `workingTree`, `dirty`, `lockfileSha256`, `versions` (node, npm, osvScanner, semgrep, electronegativity if run), `date`.                         |
| `inventory.json`         | `ships[]` and `devOnly[]`, each `{ name, version, path }`. `ships[].path` is in the built app, `devOnly[].path` in the lockfile. `electron` and the packages Vite bundled into `out/` (React and others, `bundled: true`) ship with their lockfile path. |
| `raw/findings.json`      | Normalized findings: `{ id, aliases, tool, package, path, line, severity, cvss, title, scope }`. `package` is `name@version` or null, `path` a repo file or null. |
| `raw/licenses.json`      | Shipped packages: `{ name, version, path, licenses, allowed }`. `licenses` is an array, or null if none found. `allowed`: every license is on the allow list in `scripts/security-scan/licenses.mjs`. |
| `raw/electron.json`      | Electron runtime check (see [Electron runtime](#electron-runtime)).                                                                                           |
| `raw/accepted.json`      | `{ matched, expired, unused }`. Each item is an accepted entry plus its matching `findings`.                                                                 |
| `raw/osv-*.json`         | Raw osv-scanner output, lockfile and built app. Read for advisory details and fixed versions.                                                                 |
| `raw/semgrep.json`       | Raw semgrep output. Read for rule messages and matched code.                                                                                                  |
| `raw/electronegativity.json` | SARIF, not Electronegativity's own format. Exists only with `--electronegativity`.                                                                        |

Known gaps in the inputs:

- **`scope` on code findings** is a file-name heuristic (`*.test.*` = dev-only). A hint only.

## Review checklist

Read the code at the scanned SHA (`git show <sha>:<path>`), not the working tree, unless the scan was `--working-tree`.

**Main process** ([src/main/index.ts](../../src/main/index.ts)):

- [ ] `webPreferences` of every window: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity` not disabled, no `allowRunningInsecureContent`, no `webviewTag`.
- [ ] CSP in [src/renderer/index.html](../../src/renderer/index.html) (or a header set in main): no `unsafe-eval`, no remote `script-src`, `default-src 'self'` or tighter.
- [ ] Navigation and window-open handlers: `will-navigate`, `will-redirect` and `setWindowOpenHandler` on every window, or app-wide via `web-contents-created`. A function that creates several windows: a guard on one counts for all of them. A guard set in a helper more than one call deep, or in another file: confirm it by hand. If `electron-missing-navigation-guards` flags a guarded window, say so and suggest a rule fix, never a suppression.
- [ ] `shell.openExternal`: only fixed URLs or an allow-listed scheme and host. Never a URL from the renderer unchecked.
- [ ] File paths from the renderer or from files: no path joins on unchecked input, no traversal out of the chosen folder.

**Preload and IPC** ([src/preload/index.ts](../../src/preload/index.ts), `ipcMain` handlers in main):

- [ ] `contextBridge` exposes named functions only. No raw `ipcRenderer`, no generic `send(channel, …)`.
- [ ] Every `ipcMain.handle` / `ipcMain.on` handler checks its payload's type and range before use. Include handlers registered by reference to a function from another module or another block: `electron-ipc-unvalidated-payload` doesn't see them.
- [ ] `electron-ipc-unvalidated-payload` is a heuristic. A payload checked by a predicate with an unusual name (not `is*`/`validate*`) still shows up. Read the handler before assigning relevance.
- [ ] Engine `utilityProcess` messages ([src/main/engine-process.ts](../../src/main/engine-process.ts), [src/engine/serve.ts](../../src/engine/serve.ts)): what the renderer can make the engine do.

**Engine input parsing** (untrusted input; anything here is a candidate for **reachable**):

- [ ] Show files ([show-file.ts](../../src/engine/show-file.ts)), venue files ([venue-file.ts](../../src/engine/venue-file.ts)), the profile library and its backups ([profile-library.ts](../../src/engine/profile-library.ts), [file-storage.ts](../../src/engine/file-storage.ts)): `JSON.parse` results checked before use, no prototype pollution through merges, sizes bounded.
- [ ] Fixture imports: OFL ([ofl-import.ts](../../src/engine/ofl-import.ts)) and GDTF ([gdtf-import.ts](../../src/engine/gdtf-import.ts)): zip handling (`fflate`, size and entry limits) and XML parsing (`fast-xml-parser` options: entity expansion, `processEntities`, attribute handling).
- [ ] Serial input ([serial-ports.ts](../../src/engine/serial-ports.ts), [enttec.ts](../../src/engine/enttec.ts)): frame lengths checked, no unbounded buffers.
- [ ] MIDI input ([midi-ports.ts](../../src/engine/midi-ports.ts), [midi-input.ts](../../src/engine/midi-input.ts)): message bytes checked before indexing.

**Renderer** (`src/renderer/`): a skim. Look for `dangerouslySetInnerHTML`, `eval`/`new Function`, and URLs built from file content.

A checklist item with a problem and no tool finding becomes a finding with id `manual-<short-slug>`, tool `review`, severity `—`.

## Triage

For each finding in `raw/findings.json` not in `accepted.matched`, plus the findings of `accepted.expired` entries:

- **Relevance**, one of:
  - **reachable**: ships, and untrusted input reaches it (show/venue/library files, XML, serial, MIDI).
  - **ships**: in the app, no known path from untrusted input.
  - **dev-only**: not in the app (build tools, tests, scripts).
  
  A package ships if it is in `inventory.ships` (including `electron` and the bundled packages). Otherwise dev-only.
- **Why it matters here**: one line. Name the path, or why there is none (`only used by vitest`, `parses GDTF description.xml from user-picked files`).
- **Suggested fix**: target version (the lowest fixed version from the advisory, in the same major if one exists) or a code change.

Several findings with the same cause (one advisory on two versions, one rule on several lines) stay separate rows but can share a reason.

## New since last report

1. **Pick the previous report.** In `reports/security/`, list the `*.md` files other than the current one. Ignore `*.partial` dirs (interrupted runs) and raw dirs with no `.md` (never triaged). Take the newest by date in the name. Prefer clean reports: use a `-dirty` one only if no clean one exists, and say so. On a date tie, take the one with the later `date` in its `meta.json`.
2. **Read its findings** from its raw dir's `raw/findings.json` if it still exists, else from its Findings table.
3. **Compare by key** `id` + (`package` or `path`). Older reports prefix custom rule ids with `workspaces.security.semgrep.`. Strip it before comparing.
4. **List**: new findings (key not in the previous report), and resolved ones (in the previous, not now). Ignore line-number changes.

No previous report: write "First report." in this section.

## Electron runtime

From `raw/electron.json`:

- `error` set: the check was skipped. Say so and why.
- Otherwise report `installed`, `supported` (against `supportedMajors`), `latestPatch`, and each of `newerPatches` with its date, Chrome version and `securityNotes`.
- A patch with `notesError` has unknown notes. Say so. Don't read it as "no security fixes".
- "Backported fixes from upstream ANGLE, Chromium, …" lines are security fixes, with no CVE ids.
- Not up to date with security notes: suggest the latest patch as the fix. Unsupported major: suggest the oldest supported major.

## Licenses

Shipped packages only (`raw/licenses.json`). The app is GPL-3.0-only. The compatible licenses are the allow list in `scripts/security-scan/licenses.mjs`, which packaging also enforces (`docs/development.md` § Third-party notices). Flag every row with `allowed: false`: a license off the list, `UNKNOWN`, or none found. Show a table of the flagged ones and a count per license for the rest.

## Accepted risks

From `raw/accepted.json`:

- `matched`: list under "Accepted risks" with id, package or path, reason and review-by date. Keep their findings out of the Findings list.
- `expired` with findings: the findings go back into Findings, flagged `expired acceptance (reviewBy <date>)`.
- `expired` with `findings: []`: stale entry, say so here.
- `unused`: suggest removing the entry.

## Report template

`reports/security/<YYYY-MM-DD>-<shortsha>[-dirty].md`. Sections in this order:

```markdown
# Security scan <YYYY-MM-DD> <shortsha>

| Ref | SHA | Lockfile SHA256 | Dirty | Date |
| --- | --- | --- | --- | --- |
| <meta.ref> | <full sha> | <hash> | no | <meta.date> |

Tools: node X, npm X, osv-scanner X, semgrep X[, electronegativity X].

## Summary

| Relevance | CRITICAL | HIGH | MODERATE | LOW | ERROR | WARNING | INFO | — |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| reachable | | | | | | | | |
| ships | | | | | | | | |
| dev-only | | | | | | | | |

<one or two lines: what needs action first>

## New since last report

Compared with <previous report file>. New: … Resolved: …

## Findings

Sorted by relevance (reachable, ships, dev-only), then severity.

### <id> — <package or file:line>

- Tool: <tool>, severity <severity>[, CVSS <cvss>]
- Relevance: **<relevance>** — <one-line reason>
- Why it matters here: <…>
- Suggested fix: <target version or code change>
- [Expired acceptance (reviewBy <date>)]

## Electron runtime

## Licenses

## Accepted risks

<details><summary>N accepted, N expired, N unused</summary>

| Id | Package or path | Reason | Review by |
| --- | --- | --- | --- |

</details>
```

Severity columns use the tool severity, uppercased. Electronegativity's SARIF `note` counts as INFO. A null severity counts as `—`. Drop severity columns that are empty in every row. A section with nothing to report says so in one line.
