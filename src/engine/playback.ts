import type {
  ActiveByLayer,
  EngineCommand,
  EngineEvent,
  FixtureLight,
  PlaybackMode,
} from '../shared/protocol';
import { sameNote, type MidiNote, type Show, type Trigger } from '../shared/show';
import type { VenuePatch } from '../shared/venue-patch';
import {
  activate,
  clamp,
  clearLayer,
  resolveFrames,
  resolveLights,
  type ActiveScene,
  type ActiveScenes,
} from './scene-resolution';

export type PlaybackCommand = Extract<
  EngineCommand,
  {
    type:
      | 'getPlayback'
      | 'goScene'
      | 'clearLayer'
      | 'goBaseLook'
      | 'setMode'
      | 'setGrandMaster'
      | 'setBlackout';
  }
>;

export interface PlaybackOptions {
  emit: (event: EngineEvent) => void;
  // Milliseconds.
  now: () => number;
  show: () => Show;
  patch: () => VenuePatch;
}

// A Scene flashed onto a Layer while `held`, and what the Layer held before
// it. Released by the note held, whatever its Trigger is by then.
interface Flash {
  scene: string;
  held: MidiNote;
  previous?: ActiveScene;
}

// The active Scenes, the mode, the Grand Master and Blackout. In Monitor the
// Outputs send the resolved Show; in Blind they hold the frames sent last
// before switching, while the preview keeps showing the resolved Show.
// Blackout resolves like a Grand Master at 0, so colours are kept for when it
// is turned off. It reaches the Outputs in Blind too, as a safety control;
// turned off there, they hold the frames from before again.
export function createPlayback({ emit, now, show, patch }: PlaybackOptions) {
  let active: ActiveScenes = {};
  // By Layer id.
  const flashes = new Map<string, Flash>();
  let mode: PlaybackMode = 'monitor';
  let grandMaster = 1;
  let blackout = false;
  let sent = new Map<number, Uint8Array>();

  function emitPlayback(): void {
    const scenes: ActiveByLayer = Object.fromEntries(
      Object.entries(active).map(([id, a]) => [id, a.scene]),
    );
    emit({ type: 'playback', active: scenes, mode, grandMaster, blackout });
  }

  // The Grand Master as resolved, Blackout included.
  function resolvedGrandMaster(): number {
    return blackout ? 0 : grandMaster;
  }

  function layerOf(sceneId: string): string | undefined {
    return show().scenes.find((s) => s.id === sceneId)?.layer;
  }

  function seconds(): number {
    return now() / 1000;
  }

  return {
    handle(command: PlaybackCommand): void {
      switch (command.type) {
        case 'getPlayback':
          break;
        case 'goScene': {
          const layer = layerOf(command.sceneId);
          if (layer !== undefined) flashes.delete(layer);
          active = activate(active, show(), command.sceneId, seconds());
          break;
        }
        case 'clearLayer':
          flashes.delete(command.layerId);
          active = clearLayer(active, command.layerId);
          break;
        case 'goBaseLook': {
          const { baseLook } = show();
          const layer = baseLook === undefined ? undefined : layerOf(baseLook);
          if (baseLook === undefined || layer === undefined) break;
          // Its own Layer crossfades into it; the others clear at once.
          const own = active[layer];
          flashes.clear();
          active = activate(own ? { [layer]: own } : {}, show(), baseLook, seconds());
          break;
        }
        case 'setMode':
          mode = command.mode;
          break;
        case 'setGrandMaster':
          // NaN counts as 0.
          grandMaster = clamp(command.level) || 0;
          break;
        case 'setBlackout':
          blackout = command.on;
          break;
      }
      emitPlayback();
    },
    // Fires a Trigger on its note-on. Flash holds the Scene until `noteOff`.
    fire({ scene, mode, channel, note }: Trigger): void {
      const layer = layerOf(scene);
      if (layer === undefined) return;
      const previous = flashes.get(layer)?.previous ?? active[layer];
      flashes.delete(layer);
      if (mode === 'release') active = clearLayer(active, layer);
      else active = activate(active, show(), scene, seconds());
      if (mode === 'flash') {
        flashes.set(layer, { scene, held: { channel, note }, ...(previous ? { previous } : {}) });
      }
      emitPlayback();
    },
    // Ends the Flash held by the note, putting back what its Layer held, as it
    // is by then.
    noteOff(note: MidiNote): void {
      const entry = [...flashes].find(([, flash]) => sameNote(flash.held, note));
      if (!entry) return;
      const [layer, { previous }] = entry;
      flashes.delete(layer);
      active = clearLayer(active, layer);
      if (previous) active = { ...active, [layer]: previous };
      emitPlayback();
    },
    // Stops active Scenes that are no longer in the Show or not in their
    // Layer any more. A Flash forgets such a Scene too, so it is not restored.
    showEdited(): void {
      const { scenes } = show();
      const inLayer = (layer: string, scene: string) =>
        scenes.some((s) => s.id === scene && s.layer === layer);
      for (const [layer, flash] of flashes) {
        if (!inLayer(layer, flash.scene)) flashes.delete(layer);
        else if (flash.previous && !inLayer(layer, flash.previous.scene)) delete flash.previous;
      }
      const kept = Object.entries(active).filter(([layer, { scene }]) => inLayer(layer, scene));
      if (kept.length === Object.keys(active).length) return;
      active = Object.fromEntries(kept);
      emitPlayback();
    },
    showReplaced(): void {
      active = {};
      flashes.clear();
      emitPlayback();
    },
    // The frames to send now, one per Universe. Resolved once per call.
    frames(): Map<number, Uint8Array> {
      if (mode === 'monitor') {
        sent = resolveFrames(show(), patch(), active, seconds(), resolvedGrandMaster());
      } else if (blackout) {
        return resolveFrames(show(), patch(), active, seconds(), 0);
      }
      return sent;
    },
    // How each Fixture looks now, by Fixture id, in either mode. Resolved apart
    // from `frames`, so Blind can preview what it does not send.
    lights(): Record<string, FixtureLight> {
      return resolveLights(show(), patch(), active, seconds(), resolvedGrandMaster());
    },
  };
}
