import type { EngineEvent } from '../shared/protocol';

// At most 10 frames a second: enough to watch, cheap to render.
const MONITOR_INTERVAL_MS = 100;

interface ChannelMonitorOptions {
  emit: (event: EngineEvent) => void;
  // The frame last sent for the Universe, if one is sent.
  frame: (universe: number) => Uint8Array | undefined;
}

// While a Universe is monitored, sends its frame whenever it changed. It runs
// on its own timer and only reads what the Outputs sent, so it never holds up
// or changes the frames.
export function createChannelMonitor({ emit, frame }: ChannelMonitorOptions) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let universe: number | undefined;
  let lastEmitted: Uint8Array | undefined;

  function emitFrame(): void {
    if (universe === undefined) return;
    const current = frame(universe);
    if (!current || (lastEmitted && sameValues(current, lastEmitted))) return;
    lastEmitted = current.slice();
    emit({ type: 'dmxFrame', universe, values: [...current] });
  }

  return {
    // Sends the Universe's frame at once, even if unchanged, e.g. to a
    // reloaded UI.
    start(monitored: number): void {
      universe = monitored;
      lastEmitted = undefined;
      emitFrame();
      timer ??= setInterval(emitFrame, MONITOR_INTERVAL_MS);
    },
    stop(): void {
      clearInterval(timer);
      timer = undefined;
      universe = undefined;
    },
  };
}

function sameValues(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}
