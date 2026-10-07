import type { ActiveByLayer, EngineCommand, EngineEvent, PlaybackMode } from '../shared/protocol';
import type { Show } from '../shared/show';
import type { VenuePatch } from '../shared/venue-patch';
import { activate, clearLayer, resolveFrames, type ActiveScenes } from './scene-resolution';

export type PlaybackCommand = Extract<
  EngineCommand,
  { type: 'getPlayback' | 'goScene' | 'clearLayer' | 'setMode' }
>;

export interface PlaybackOptions {
  emit: (event: EngineEvent) => void;
  // Milliseconds.
  now: () => number;
  show: () => Show;
  patch: () => VenuePatch;
}

// The active Scenes and the mode. In Monitor the Outputs send the resolved
// Show; in Blind they hold the frames sent last before switching.
export function createPlayback({ emit, now, show, patch }: PlaybackOptions) {
  let active: ActiveScenes = {};
  let mode: PlaybackMode = 'monitor';
  let sent = new Map<number, Uint8Array>();

  function emitPlayback(): void {
    const scenes: ActiveByLayer = Object.fromEntries(
      Object.entries(active).map(([id, a]) => [id, a.scene]),
    );
    emit({ type: 'playback', active: scenes, mode });
  }

  function seconds(): number {
    return now() / 1000;
  }

  return {
    handle(command: PlaybackCommand): void {
      switch (command.type) {
        case 'getPlayback':
          break;
        case 'goScene':
          active = activate(active, show(), command.sceneId, seconds());
          break;
        case 'clearLayer':
          active = clearLayer(active, command.layerId);
          break;
        case 'setMode':
          mode = command.mode;
          break;
      }
      emitPlayback();
    },
    // Stops active Scenes that are no longer in the Show or not in their
    // Layer any more.
    showEdited(): void {
      const { scenes } = show();
      const kept = Object.entries(active).filter(([layer, { scene }]) =>
        scenes.some((s) => s.id === scene && s.layer === layer),
      );
      if (kept.length === Object.keys(active).length) return;
      active = Object.fromEntries(kept);
      emitPlayback();
    },
    showReplaced(): void {
      active = {};
      emitPlayback();
    },
    // The frames to send now, one per Universe. Resolved once per call.
    frames(): Map<number, Uint8Array> {
      if (mode === 'monitor') sent = resolveFrames(show(), patch(), active, seconds());
      return sent;
    },
  };
}
