import type { DocumentSnapshot, EngineSnapshot } from '../shared/protocol';

// The least time between two playback parts, so a Grand Master fader or a
// Tap Tempo burst does not flood the parent port.
export const PLAYBACK_PART_MS = 100;

type Part = keyof EngineSnapshot;

// Reports the engine's snapshot to main (ADR 0011): whole on `full`, then
// each part that changed. Before the first `full`, changes are not reported.
// A document part goes at once, and only when the document, its path or its
// unsaved state differ from the last one sent. Playback parts go at most
// every PLAYBACK_PART_MS: the first at once, then the latest at the end of
// the wait.
export function createSnapshotReporter(
  current: () => EngineSnapshot,
  report: (part: Partial<EngineSnapshot>) => void,
) {
  let last: EngineSnapshot | undefined;
  let wait: ReturnType<typeof setTimeout> | undefined;
  let playbackChanged = false;

  function sendPlayback(): void {
    if (!last) return;
    last = { ...last, playback: current().playback };
    report({ playback: last.playback });
    playbackChanged = false;
    wait = setTimeout(() => {
      wait = undefined;
      if (playbackChanged) sendPlayback();
    }, PLAYBACK_PART_MS);
  }

  return {
    full(): EngineSnapshot {
      last = current();
      return last;
    },
    changed(part: Part): void {
      if (!last) return;
      if (part === 'playback') {
        playbackChanged = true;
        if (wait === undefined) sendPlayback();
        return;
      }
      const now = current();
      const same =
        part === 'midiInput'
          ? now.midiInput.selected === last.midiInput.selected
          : sameDocument(now[part], last[part]);
      if (same) return;
      last = { ...last, [part]: now[part] };
      report({ [part]: now[part] });
    },
  };
}

// Documents are immutable, so an edit always makes a new one.
function sameDocument(a: DocumentSnapshot<unknown>, b: DocumentSnapshot<unknown>): boolean {
  return a.document === b.document && a.path === b.path && a.unsaved === b.unsaved;
}
