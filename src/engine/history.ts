import type { DocumentState } from '../shared/protocol';

// Undo/Redo over an immutable document, such as a Show or a Venue Patch. Each
// edit keeps the document it replaced. The document is unsaved while it is
// not the one last saved, so undoing back to it clears the unsaved state.
// Edits with the same merge key, each within this long of the last, are one
// undo step: typing in a field, or dragging a colour slider.
const MERGE_MS = 1000;

// The most undo steps kept.
const HISTORY_LIMIT = 200;

export function createHistory<T>(initial: T, { now }: { now: () => number }) {
  let current = initial;
  // Undefined when no saved document is in the history, after a restore of
  // an unsaved one.
  let saved: T | undefined = initial;
  let past: T[] = [];
  let future: T[] = [];
  // The last edit's merge key and time, while the next may merge with it.
  let mergeable: { key: string; at: number } | undefined;

  function restore(document: T, unsaved: boolean): void {
    current = document;
    saved = unsaved ? undefined : document;
    past = [];
    future = [];
    mergeable = undefined;
  }

  return {
    current: () => current,
    state: (): DocumentState => ({
      unsaved: current !== saved,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
    }),

    // `key` names what the edit changes; an edit without one never merges.
    edit(next: T, key?: string): void {
      const at = now();
      const merge = key !== undefined && mergeable?.key === key && at - mergeable.at <= MERGE_MS;
      if (!merge) past = [...past, current].slice(-HISTORY_LIMIT);
      current = next;
      future = [];
      mergeable = key === undefined ? undefined : { key, at };
    },

    // Each returns whether there was a step to take.
    undo(): boolean {
      if (past.length === 0) return false;
      future = [current, ...future];
      current = past.at(-1) as T;
      past = past.slice(0, -1);
      mergeable = undefined;
      return true;
    },
    redo(): boolean {
      if (future.length === 0) return false;
      past = [...past, current];
      current = future[0] as T;
      future = future.slice(1);
      mergeable = undefined;
      return true;
    },

    markSaved(): void {
      saved = current;
      mergeable = undefined;
    },

    // A new or opened document: saved, with no history.
    reset: (document: T) => restore(document, false),

    // A document brought back after an engine restart, with no history. An
    // unsaved one stays unsaved until it is saved.
    restore,
  };
}
