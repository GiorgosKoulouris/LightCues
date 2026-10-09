# Toggle to hide Fixture labels

Status: ready-for-agent
Blocked by: 02

See spec, "Fixture labels".

## Acceptance

- An icon toggle in the Fixtures tab's action bar, next to the inspector toggle, with an accessible name and `aria-pressed`. Shown on the Fixtures tab only.
- Off hides the Fixture labels on the stage plan. The selected Fixtures and the dragged Fixture still show their labels. Every marker keeps its `<title>` tooltip.
- Remembered on this machine between runs, like the recent files. Not saved in the Venue Patch, and not on undo. Labels are shown on first launch.
- The Focus Check beams are not affected.
- Tests: the toggle hides and shows labels, the selected Fixture keeps its label, the setting survives a remount.
