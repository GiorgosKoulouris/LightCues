# Distribution

Batch 7 of the 2026-10-09 repo plan. Last on purpose: the SignPath application goes better with a finished README, releases and a changelog.

There is no update mechanism. `latest.yml` and the blockmap are built for "a future auto-updater". The installer is unsigned, so Windows SmartScreen warns on every new version.

## Scope

1. An update check (issue 01).
2. Code signing through SignPath Foundation (issue 02).

Out of scope: downloading or installing updates from the app.

## Decisions (2026-10-09)

### Update check

- Check only. The app never downloads or installs anything. A live tool must not change mid-gig.
- Main asks the GitHub Releases API for the latest non-prerelease release, at most once a day, a few seconds after launch. One request, no identifying data beyond what an HTTPS request carries.
- If it is newer than the running version, the renderer shows a quiet notice ("LightCues X.Y.Z is available") with a button that opens the release page in the default browser. The notice never shows in Perform. It waits until you leave it.
- A setting turns the check off. On by default. Failures are silent and go to the log.
- `latest.yml` and the blockmap stay in the release, for a possible updater later. ADR 0006 already says why.
- Record as ADR 0012: check-only updates, and why.

### Code signing

- SignPath Foundation: free code signing for open-source projects. The certificate belongs to SignPath, and the publisher shows as the project.
- Signing runs in `release.yml` only, on tag builds. `stage` and `main` builds stay unsigned.
- Until it is approved, the README keeps the SmartScreen note.

## Order

01 and 02 are independent. 02 waits on SignPath's approval.
