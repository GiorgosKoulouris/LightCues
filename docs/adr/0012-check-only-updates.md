# Updates are checked, never installed

A few seconds after launch, main asks the GitHub Releases API for the latest release, at most once a day. If it is newer than the running version, the Sidebar shows a quiet notice with a button that opens the release page in the default browser. The app never downloads or installs anything: a live tool must not change mid-gig, and an update installed between soundcheck and show is a risk with no upside on the night. The user installs the new version over the old one when they choose.

The notice never shows in Perform; it waits until the user leaves it. A setting, "Check on startup", turns the startup check off; it is on by default. A button beside it checks at once, whatever the setting, and says when the app is up to date or the check failed. The request carries nothing beyond what any HTTPS request does. Failures of the startup check are silent and go to the log. The last check and the release it found are kept in `update-check.json` in `userData`, so a launch within the day still shows the notice without a request.

Main makes the request, not the renderer, so the renderer's CSP and navigation guards stay as they are. Main opens only this project's release pages (`https://github.com/GiorgosKoulouris/LightCues/releases/…`), whatever the renderer asks.

`latest.yml` and the blockmap stay in each release (ADR 0006), so an updater can still be added later.

## Considered Options

- electron-updater with auto-download and install on quit: no manual step, but the app changes without the user choosing when, and unsigned updates fail or warn on Windows.
- electron-updater with download on request: still installs from inside the app, adds a dependency, and needs code signing first.
- No check: nothing to maintain, but users stay on old versions without knowing.
- Check from the renderer: simpler IPC, but the CSP would have to allow `api.github.com`.
