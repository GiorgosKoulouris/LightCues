# Visual polish

Small layout and sizing fixes to the Venue Patch, the shell and Perform, plus Scene buttons that toggle.

Today the whole window scrolls when the stage plan is tall. That moves the sidebar off screen and pushes Add Fixture below the fold, even with one Fixture. Fixture markers and labels on the stage plan are sized in stage metres (0.25 m radius, 0.28 m text), so three labelled Fixtures in one Zone collide. Perform Scene buttons are 180 × 64 px with xl text. Clear is per Layer, at the end of the Layer header.

Terms: Scene button, Trigger, Layer, Fallback Panel, Zone (see `CONTEXT.md`).

## Scope

1. Only the view's columns scroll, never the window (issue 01).
2. Fixed screen size for Fixtures and grid labels on the stage plan and in the Preview (issue 02).
3. A toggle to hide Fixture labels on the stage plan (issue 03).
4. Smaller Perform Scene buttons (issue 04).
5. Scene buttons toggle (issue 05).

## Decisions (2026-10-09)

### Scrolling

- The window never scrolls, in any view. The sidebar, top bar and Fallback Panel strip stay in place.
- Each column of a view scrolls on its own: in the Venue Patch, the Fixture list, the plan and the inspector.
- Add Fixture stays visible below the Fixture list.

### Stage plan sizes

- Fixture markers are about 10 px across and Fixture labels about 11 px, whatever the stage size or window size.
- The Zone grid labels ("Stage Right", "Up", …) are fixed pixel sizes too.
- The Preview (Show view and Perform) draws its Fixture markers at the same size as the plan. One shared size.
- Stage geometry (stage, Zones, beam lines, snapping) stays in metres.

### Fixture labels

- An icon toggle in the Fixtures tab's action bar, next to the inspector toggle, shows or hides Fixture labels on the plan.
- Remembered on this machine between runs, like the recent files. Not part of the Venue Patch. Labels are shown by default.
- With labels hidden, the selected Fixtures and the one being dragged still show their labels. Every marker keeps its hover tooltip.

### Perform Scene buttons

- 160 × 52 px minimum, lg text. Long names still wrap.
- Other Perform controls (Blackout, Base Look, Grand Master, Tap Tempo, Freeze) keep their gig size.
- A small Clear stays in each Layer header, for the keyboard and for screen readers.

### Scene buttons toggle

- A Scene button activates its Scene, or clears its Layer if that Scene is already active (the same as a Release).
- Applies to the Perform Scene buttons and to the Fallback Panel's Scene buttons and their keys.
- MIDI Go Triggers stay Go: MIDI already has Release, and a DAW may send Go twice on purpose.
- The Show view's Go stays Go: it is for editing.
- An active Scene can no longer be restarted from its Scene button.

## Out of scope

- User-adjustable density or button size.
- Showing labels only on hover.
- Changing Trigger actions or the Show view.
- Resizing the Perform controls other than Scene buttons.
