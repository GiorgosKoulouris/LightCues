# Inspector and Zone picker spacing

Status: ready-for-agent

See spec, "Spacing".

## Acceptance

- Venue Patch: the inspector's fields keep a gap from its scrollbar, scrolled or not.
- Rule editor: each Zone picker plan has a gap above its "Floor" / "Overhead" caption.
- Check by eye in the running app.

## Comments

### 2026-10-09: implemented (agent)

- Inspector (`FixtureInspector.module.css`): `padding-right: var(--space-3)` and `scrollbar-gutter: stable`. The Show view's right column (`ShowView.module.css` `.side`, Preview and Layers) had the same problem and got the same fix.
- Zone pickers: each plan is a flex column with `gap: var(--space-2)` above its caption.

Not checked in the running app (Electron can't run in the dev container). Left for a human: the gap reads well with and without a scrollbar.
