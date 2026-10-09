# Only view columns scroll, never the window

Status: resolved

See spec, "Scrolling".

## Acceptance

- The height chain from `#root` through `App` (`.app`, `.main`, `.content`) and each view is bounded by the window, so no grid row or flex item grows past it. The stage plan SVG takes its size from its column, not from its aspect ratio.
- The window itself never scrolls, in any view (Show, Venue Patch, Profile Library, Perform). The sidebar, top bar and Fallback Panel strip stay in place.
- Venue Patch: the Fixture list, the plan and the inspector each scroll on their own. Add Fixture stays visible under the list with one Fixture or many.
- Check the other views' columns still scroll (Show scene list and editor, Profile Library, Perform groups and Preview).
- jsdom does no layout, so check in the running app at 1280 × 720 and below 1280 px wide (inspector as a SidePanel). Record what was checked in the comments.

## Comments

### 2026-10-09 — implemented (agent)

CSS only. The window scrolled because `.app` had an implicit `auto` grid row, which grows to the content height of `.main`.

- `.app`: `grid-template-rows: minmax(0, 1fr)`. Bounds the whole chain to the window.
- Each view's column grid gets an explicit `minmax(0, 1fr)` row: Venue Patch `.fixtures`, Show `.scenes`, Profile Library `.view`, Perform `.body`.
- Stage plan SVG: `height: 0` with `flex: 1`, so it is sized by its column, not its aspect ratio. It fits the column rather than scrolling.
- Rig setup: `.rig` scrolls on its own, so the tab bar stays in place with many Universes.

Typecheck and the full test suite pass. jsdom does no layout, so there are no new tests.

Not checked: the running app. Electron can't run in the dev container. Left for a human on the Windows host:

- 1280 × 720 and below 1280 px wide (inspector as a SidePanel), in Show, Venue Patch (both tabs), Profile Library and Perform.
- The window never scrolls. The sidebar, top bar and Fallback Panel strip stay in place.
- Venue Patch: Add Fixture is visible under the list with one Fixture and with many. The list and the inspector scroll. A tall stage fits the plan column.
- Rig setup: the scrollbar sits at the 800 px column edge, not the window edge. Check that this looks right.

Set back to `resolved` once this is checked.

### 2026-10-09: resolved

Marked resolved by the user.
