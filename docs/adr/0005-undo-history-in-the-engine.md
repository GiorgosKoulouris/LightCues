# Undo history lives in the engine

The engine keeps an undo history per Show and per Venue Patch, as snapshots of the immutable document. Undo and Redo are engine commands, so playback and the Outputs react to them as to any edit. A document is unsaved while it is not the snapshot last saved, so undoing back to it clears the unsaved dot and the close guard. New and Open forget the history; Save keeps it. Quick edits to the same existing thing (a Scene, a Layer, a Trigger, a Universe, the same Fixtures, the stage, the Default Colour), each within 1 s of the last, merge into one step, because fields commit on every valid keystroke. Adding, removing and stage-plan moves never merge. Removing a Show or Venue Patch item no longer asks; an info toast says what went. Profile Library changes and New/Open still ask, because they cannot be undone.

## Considered Options

- History in the renderer, as inverse edits: no protocol change, but it cannot tell when an undo returns to the saved state, and a reload loses it.
- Merge by a field's focus session, tagged by the renderer: more exact than a time window, but threads a group id through every field callback.
