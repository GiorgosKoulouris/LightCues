# Code signing through SignPath Foundation

Status: ready-for-human

See spec, "Code signing". The application and the account setup are yours. The CI wiring is agent work once you have the project and policy slugs.

## Fix

1. Read SignPath Foundation's current requirements for open-source projects (license, activity, release process, a code signing policy page). Check LightCues meets them: GPL-3.0, public repo, tagged CI releases, changelog, README.
2. Add the code signing policy they ask for to the repo (e.g. `docs/code-signing.md`, linked from the README): who signs, which builds are signed (tag builds from `release.yml` only), how to report misuse.
3. Apply. Wait for approval.
4. After approval: add the SignPath API token as a repo secret, scoped to a `release` environment that only runs for `v*` tags.
5. Agent: in `release.yml`, after `npm run package`, upload the unsigned `.exe` as an artifact, submit it to SignPath with their GitHub Action (pinned by SHA), wait, download the signed `.exe`, and regenerate `latest.yml` and the blockmap for the signed file before `gh release create`. The hash in `latest.yml` must match the signed file.
6. Remove the SmartScreen note from the README and add "Signed by SignPath Foundation" where they ask for credit.

## Acceptance

- A release installer shows the publisher in its Properties → Digital Signatures tab.
- `latest.yml`'s `sha512` matches the published signed `.exe`.
- A fresh Windows machine installs it without the "unknown publisher" warning. SmartScreen reputation can take a few releases to build. Note what you see.
