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
6. Spacing: the inspector clear of its scrollbar, the Zone picker captions clear of their plans (issue 06).
7. Stage views use their space: less padding, true scale kept (issue 07).
8. Rule Zone pickers grow with their column (issue 08).

## Decisions (2026-10-09)

### Scrolling

- The window never scrolls, in any view. The sidebar, top bar and Fallback Panel strip stay in place.
- Each column of a view scrolls on its own: in the Venue Patch, the Fixture list, the plan and the inspector.
- Add Fixture stays visible below the Fixture list.

### Stage plan sizes

- Fixture markers are about 14 px across and Fixture labels about 11 px, whatever the stage size or window size.
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

## Decisions (2026-10-09, second pass)

### Spacing

- The Venue Patch inspector keeps a gap between its fields and its scrollbar.
- The Rule Zone pickers keep a gap between each plan and its "Floor" / "Overhead" caption. Spacing only, no rule line.

### Stage views fit

Applies to the stage plan, the Preview's top-down view and the Rule Zone pickers.

- True scale stays: no stretching, no zoom or pan. A stage whose shape differs from its column still leaves space on two sides.
- The Front row is drawn 1 m deep, whatever the stage. It is only drawn: a Fixture with y < 0 is in the Front row anyway.
- No margin in metres around the stage. The view is the stage and the Front row, grown to take in any Fixture outside them. Labels keep their fixed pixel room.
- The audience plane is no longer drawn, in the Preview or in the Focus Check. Both show the same view as the plan. A beam that leaves the view is cut at its edge and ends in a small arrow.

### Rule Zone pickers

- Each picker fills its share of the width, at true scale, but no taller than about 320 px.

## Out of scope

- User-adjustable density or button size.
- Showing labels only on hover.
- Changing Trigger actions or the Show view.
- Resizing the Perform controls other than Scene buttons.
- Stretching the stage, or zoom and pan.
- The Preview's front elevation.
