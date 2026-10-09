# Security scan

An ad hoc scan of LightCues and its dependencies. It builds the app from one commit, finds what ships in the Windows installer, scans it and writes one Markdown report. It is not part of CI and never blocks a merge or a release. Design: [ADR 0009](adr/0009-ad-hoc-security-scan.md).

What it covers:

- **Dependencies**: every package in `package-lock.json` and in the built app, checked with osv-scanner.
- **Source code**: semgrep over `src/`, with registry packs and the custom Electron rules in [security/semgrep/](../security/semgrep/).
- **Electron hardening**: `webPreferences`, CSP, preload and IPC, navigation and window-open handlers, `shell.openExternal`, file paths from untrusted input. Part rules, part Claude's review.
- **Electron runtime**: the installed Electron against the Electron releases feed. Chromium and Node fixes rarely show up as npm advisories.
- **Licenses** of shipped packages, against GPL-3.0-only.

## Prerequisites

- **The devcontainer**, rebuilt with the pinned tools. osv-scanner and semgrep are installed by the [Dockerfile](../.devcontainer/Dockerfile). The scan does not run on the Windows host.
- **Network access** to:
  - the npm registry (`npm ci` in the build, and `npx` for `--electronegativity`),
  - `api.osv.dev` and `api.deps.dev` (osv-scanner: advisories and licenses),
  - `semgrep.dev` (the registry rule packs, fetched every run),
  - `releases.electronjs.org` and `api.github.com` (the Electron feed and release notes),
  - `github.com` (electron-builder downloads the Windows Electron build and its build tools on the first run).

If a tool is missing or its version differs from the pin, the scan stops with `… expected X. Rebuild the devcontainer.` In VS Code: **Dev Containers: Rebuild Container**.

## Running it

Ask Claude to **"run the security scan"**. Claude runs the script, reviews the outputs and the code, and writes the report. Add any of the options below to the request, for example "run the security scan on v0.2.0".

`npm run security:scan` runs only the script. It writes the raw outputs and a one-line summary, with no triage and no report.

```sh
npm run security:scan                            # HEAD (default)
npm run security:scan -- --ref <ref>             # any branch, tag or commit
npm run security:scan -- --release v0.2.0        # a release tag
npm run security:scan -- --working-tree          # the working tree, local edits included
npm run security:scan -- --electronegativity     # add Electronegativity as a second opinion
npm run security:scan -- --keep-worktree         # keep the build afterwards
```

| Option | Use it for |
| --- | --- |
| (none) | The current commit. Uncommitted edits are not scanned. |
| `--ref <ref>` | Any commit, for example `--ref stage` to check a staged batch, or `--ref main` after a merge, before tagging. |
| `--release vX.Y.Z` | A shipped version. The tag must exist and look like `v1.2.3`. For a prerelease tag (`v0.3.0-rc.1`) or before tagging, use `--ref`. |
| `--working-tree` | Edits not committed yet. Tracked and untracked files are copied as they are, ignored files are left out. The output is marked `-dirty` if anything is uncommitted. Such a report is not tied to a commit or an installer. |
| `--electronegativity` | An extra Electron check, fetched with `npx`. Off by default: upstream is mostly unmaintained. |
| `--keep-worktree` | Keeping the build to look at the built app. The script prints where it is and the command to remove it. |

Pass only one of `--ref`, `--release` and `--working-tree`. `--electronegativity` and `--keep-worktree` combine with any of them.

### What it does

1. Checks the tool versions against the Dockerfile pins.
2. Creates a temporary `git worktree` of the commit (or copies the working tree) under the system temp dir.
3. Runs `npm ci`, `electron-vite build` and `electron-builder --win --dir`, the same steps as the release build without the NSIS installer.
4. Extracts `app.asar`. The packages found in it, plus `electron`, are **ships**. Everything else in the lockfile is **dev-only**, with one exception: packages bundled into the renderer (React and others) are not in `app.asar`'s `node_modules`. Claude counts them as shipped during triage.
5. Runs osv-scanner, semgrep and the Electron runtime check, and matches the findings against [security/accepted.yml](../security/accepted.yml).
6. Removes the worktree, unless `--keep-worktree`.

Your files, `node_modules` and branches are not touched. The scan writes only to `reports/security/`, plus a temporary worktree entry in `.git` that is removed at the end. The semgrep rules, the accepted risks and the tool pins come from your current checkout, not from the scanned commit, so an old release is scanned with today's rules.

It takes a few minutes. Most of it is `npm ci` and the build. The first run also downloads the Windows Electron build. Claude's review adds more time on top.

Ctrl+C stops the scan and removes the worktree (unless `--keep-worktree`). A failed or stopped scan writes no report. A stopped one leaves a `*.partial` dir.

## Where the output goes

```text
reports/security/
  2026-10-09-62f550f/       raw outputs: meta.json, inventory.json, raw/*.json
  2026-10-09-62f550f.md     the report, written by Claude
```

The name is the scan date (UTC) and the short SHA, plus `-dirty` for a dirty `--working-tree` scan. A `*.partial` dir is a scan that was interrupted. Delete it.

`reports/` is gitignored. A report can name weaknesses that are exploitable in a released version, and the repo is public. Don't commit a report or paste its contents into issues, commits or PRs. Keep old reports: the next report is compared with the latest one.

## Reading the report

The sections, in order:

1. **Header**: ref, commit SHA, lockfile hash, dirty flag, tool versions, date. A release built from the same commit is covered by the report.
2. **Summary**: counts by relevance and severity, and what to act on first.
3. **New since last report**: findings that are new or resolved since the previous report. Line moves don't count as new.
4. **Findings**, sorted by relevance, then severity.
5. **Electron runtime**.
6. **Licenses**.
7. **Accepted risks**, collapsed.

**Relevance vs severity.** Severity is the tool's rating, shown unchanged. Relevance is Claude's call for this app:

| Relevance | Meaning |
| --- | --- |
| **reachable** | Ships, and untrusted input reaches it: show, venue or library files, XML in fixture imports, serial or MIDI input. Act on these first. |
| **ships** | In the app, with no known path from untrusted input. |
| **dev-only** | Not in the app: build tools, tests, scripts. |

A HIGH dev-only finding usually matters less than a MODERATE reachable one. "Ships" comes from the built app, not from the `dependencies` / `devDependencies` split: Electron and React are devDependencies, and both ship.

Each finding has a reason for its relevance and a suggested fix: a target version or a specific code change. Findings with id `manual-…` come from Claude's review, not from a tool.

**Electron runtime.** The installed version, whether its major is still supported (the latest 3 stable majors), the latest patch of that major, and the newer patches with security fixes. Electron lists Chromium fixes as "Backported fixes from upstream …", with no CVE ids. Those count. If the feed could not be fetched, the section says the check was skipped.

**Licenses.** Shipped packages only. Licenses compatible with GPL-3.0-only are counted. Anything else, or a missing license, is listed.

## Accepting a risk

When a finding is not worth fixing now, accept it in [security/accepted.yml](../security/accepted.yml) on `dev`:

```yaml
- id: GHSA-xxxx-xxxx-xxxx           # id from the report; a CVE or GHSA alias also matches
  package: fast-xml-parser@5.11.2   # for a dependency: name@version
  reason: Only parses show files the user picked. No network input.
  accepted: 2026-10-09
  reviewBy: 2027-01-09
```

For a code finding, use `path: src/main/index.ts` instead of `package`. It matches any line in that file.

- **`package` is pinned to a version.** After an upgrade the entry no longer matches, and the report suggests removing it.
- **Pick `reviewBy`** by how bad it would be if you were wrong: about 3 months for a ships finding, up to a year for dev-only. Don't accept a reachable finding for long.
- **When `reviewBy` passes**, the finding is back in Findings, flagged as an expired acceptance. Fix it, or review it and move the date.
- An expired entry that matches nothing is listed as stale. Remove it.
- Accepted findings stay visible under "Accepted risks", with the reason and date.

The scan stops on a malformed entry and names it.

## Acting on a finding

1. Open an issue under `.scratch/<feature>/issues/` (see [docs/agents/issue-tracker.md](agents/issue-tracker.md)). Describe the fix, not the exploit: the repo is public.
2. Fix it on `dev`.
3. Re-run the scan, with `--working-tree` before committing or on `HEAD` after. The finding shows as resolved under "New since last report".

The scan never fixes anything itself. No `npm audit fix`, no version bumps.

## Custom Electron rules

[security/semgrep/electron.yml](../security/semgrep/electron.yml) holds rules for Electron hardening. Their test cases are the `ruleid:` and `ok:` comments in [electron.ts](../security/semgrep/electron.ts).

```sh
npm run security:test-rules     # semgrep --test on security/semgrep
```

- A rule change needs a `ruleid:` (should match) or `ok:` (should not match) case in `electron.ts`.
- App-wide window guards (`app.on('web-contents-created', …)`) cover every window in a file, so their cases go in [electron.app-guard.ts](../security/semgrep/electron.app-guard.ts). That file has no annotations: any finding in it fails the test.
- Keep test cases in `.ts` files. Semgrep loads every YAML file in the folder as rules.
- A rule that flags safe code: fix the rule, don't accept the finding.

## Updating the tools

The versions are pinned as `ARG`s in [.devcontainer/Dockerfile](../.devcontainer/Dockerfile):

| ARG | What |
| --- | --- |
| `OSV_SCANNER_VERSION` | osv-scanner release |
| `OSV_SCANNER_SHA256_AMD64`, `OSV_SCANNER_SHA256_ARM64` | SHA256 of `osv-scanner_linux_amd64` / `_arm64` from that release |
| `SEMGREP_VERSION` | semgrep on PyPI |

1. Pick the new versions. For osv-scanner, copy both SHA256s from the release's checksums file.
2. Edit the ARGs on `dev`.
3. Rebuild the devcontainer. The build fails if a SHA256 doesn't match.
4. Run `npm run security:test-rules`, then a scan. Compare with the last report: a tool upgrade can add or drop findings.
5. Commit the Dockerfile.

Electronegativity is pinned in [scripts/security-scan.mjs](../scripts/security-scan.mjs) (`ELECTRONEGATIVITY_VERSION`), not in the Dockerfile.
