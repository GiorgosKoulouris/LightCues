import type {
  ActiveByLayer,
  EngineCommand,
  EngineEvent,
  FixtureLight,
  PlaybackMode,
} from '../shared/protocol';
import { sameNote, type Direction, type MidiNote, type Show, type Trigger } from '../shared/show';
import type { VenuePatch } from '../shared/venue-patch';
import {
  activate,
  clamp,
  clearLayer,
  focusCheckFrames,
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
      | 'setBlackout'
      | 'setFocusCheck';
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
// turned off there, they hold the frames from before again. The Focus Check
// overrides the moving Fixtures on the Outputs in both modes, at full unless
// Blackout is on. It is not part of the Show or the Venue Patch.
export function createPlayback({ emit, now, show, patch }: PlaybackOptions) {
  let active: ActiveScenes = {};
  // By Layer id.
  const flashes = new Map<string, Flash>();
  let mode: PlaybackMode = 'monitor';
  let grandMaster = 1;
  let blackout = false;
  let focusCheck: Direction | undefined;
  let sent = new Map<number, Uint8Array>();

  function emitPlayback(): void {
    const scenes: ActiveByLayer = Object.fromEntries(
      Object.entries(active).map(([id, a]) => [id, a.scene]),
    );
    emit({
      type: 'playback',
      active: scenes,
      mode,
      grandMaster,
      blackout,
      ...(focusCheck === undefined ? {} : { focusCheck }),
    });
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

  function go(from: ActiveScenes, sceneId: string): ActiveScenes {
    return activate(from, show(), patch(), sceneId, seconds(), resolvedGrandMaster());
  }

  return {
    handle(command: PlaybackCommand): void {
      switch (command.type) {
        case 'getPlayback':
          break;
        case 'goScene': {
          const layer = layerOf(command.sceneId);
          if (layer !== undefined) flashes.delete(layer);
          active = go(active, command.sceneId);
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
          // Its own Layer crossfades into it, from what all of them show; the
          // others clear at once.
          flashes.clear();
          active = { [layer]: go(active, baseLook)[layer]! };
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
        case 'setFocusCheck':
          focusCheck = command.direction;
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
      else active = go(active, scene);
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
    // Ends the Focus Check, when the Venue Patch is replaced.
    venueReplaced(): void {
      if (focusCheck === undefined) return;
      focusCheck = undefined;
      emitPlayback();
    },
    // The frames to send now, one per Universe. Resolved once per call.
    frames(): Map<number, Uint8Array> {
      if (mode === 'monitor') {
        sent = resolveFrames(show(), patch(), active, seconds(), resolvedGrandMaster());
      }
      let frames = sent;
      if (mode === 'blind' && blackout) {
        frames = resolveFrames(show(), patch(), active, seconds(), 0);
      }
      if (focusCheck === undefined) return frames;
      return focusCheckFrames(patch(), frames, focusCheck, blackout ? 0 : 1);
    },
    // How each Fixture looks now, by Fixture id, in either mode. Resolved apart
    // from `frames`, so Blind can preview what it does not send.
    lights(): Record<string, FixtureLight> {
      return resolveLights(show(), patch(), active, seconds(), resolvedGrandMaster());
    },
  };
}
