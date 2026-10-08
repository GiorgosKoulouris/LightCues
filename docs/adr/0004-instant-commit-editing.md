# Instant commit editing, with Profiles as the exception

Edits to a Show and a Venue Patch commit field by field as soon as they are valid. An invalid field shows its error inline, is not committed, and reverts on Esc. Destructive actions ask through an in-app dialog. The Profile Editor keeps explicit Save/Cancel, because a Profile mid-edit is usually invalid as a whole and writes to the shared Profile Library. Undo/Redo would be better than confirm dialogs, but it needs engine work and is deferred. Superseded in part by [ADR 0005](0005-undo-history-in-the-engine.md): Show and Venue Patch removals are undone instead of confirmed.

## Considered Options

- Draft + Apply everywhere: safe, but slow for the many small edits programming a Show needs.
- Instant commit with Undo/Redo instead of confirms: the target, once undo exists.
