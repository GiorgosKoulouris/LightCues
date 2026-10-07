import type { EngineEvent, FixtureLight } from '../shared/protocol';

// ~40 Hz, the Outputs' frame rate.
const PREVIEW_INTERVAL_MS = 25;

interface PreviewOptions {
  emit: (event: EngineEvent) => void;
  // How every Fixture looks now, by Fixture id.
  lights: () => Record<string, FixtureLight>;
}

// While started, sends how the Fixtures look whenever it changes. It runs on
// its own timer and only reads the resolved state, so it never holds up or
// changes the frames sent to the Outputs.
export function createPreview({ emit, lights }: PreviewOptions) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastEmitted = '';

  function emitLights({ always }: { always: boolean }): void {
    const current = lights();
    const json = JSON.stringify(current);
    if (json === lastEmitted && !always) return;
    lastEmitted = json;
    emit({ type: 'preview', lights: current });
  }

  return {
    // Sends the current lights at once, even if unchanged, e.g. to a reloaded
    // UI.
    start(): void {
      emitLights({ always: true });
      timer ??= setInterval(() => emitLights({ always: false }), PREVIEW_INTERVAL_MS);
    },
    stop(): void {
      clearInterval(timer);
      timer = undefined;
    },
  };
}
