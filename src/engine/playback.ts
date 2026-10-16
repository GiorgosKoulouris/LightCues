import type {
  ActiveByLayer,
  EngineCommand,
  EngineEvent,
  FixtureLight,
  LimitedByLayer,
  PlaybackMode,
  PlaybackSnapshot,
} from '../shared/protocol';
import {
  NO_EFFECT,
  SPEED_LIMIT,
  sameNote,
  type Direction,
  type EffectLength,
  type MidiNote,
  type MovementEffect,
  type Show,
  type Trigger,
} from '../shared/show';
import { fitSpeedLimit } from '../shared/speed-limit';
import type { VenuePatch } from '../shared/venue-patch';
import {
  activate,
  clamp,
  clearLayer,
  focusCheckFrames,
  focusCheckLights,
  resolveFrames,
  resolveLights,
  type ActiveScene,
  type ActiveScenes,
  type EffectRuns,
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
      | 'setFreeze'
      | 'setFocusCheck';
  }
>;

// How far under the Speed limit an Effect must be at a shorter length to step
// back down to it, so the length does not flip while the Tempo hovers.
const STEP_DOWN_LIMIT = 0.9 * SPEED_LIMIT;

// The length and size a movement Effect runs at, held between frames, and the
// Effect they were fitted for.
interface HeldLength {
  effect: MovementEffect;
  length: EffectLength;
  size: number;
}

// The playback part of a snapshot, without the Tempo.
export type LiveLook = Omit<PlaybackSnapshot, 'bpm' | 'tempoSource'>;

// How long ago restored Scenes count as activated, in seconds: longer than
// any fade-in.
const RESTORED_AGE_S = 1e6;

export interface PlaybackOptions {
  emit: (event: EngineEvent) => void;
  // Milliseconds.
  now: () => number;
  // The Tempo's beat count, that movement Effects run to.
  beat: () => number;
  // The Tempo, that beat strobe rates follow.
  bpm: () => number;
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

// The active Scenes, the mode, the Grand Master, Blackout and Freeze. In Monitor the
// Outputs send the resolved Show; in Blind they hold the frames sent last
// before switching, while the preview keeps showing the resolved Show.
// Blackout resolves like a Grand Master at 0, so colours are kept for when it
// is turned off. It reaches the Outputs in Blind too, as a safety control;
// turned off there, they hold the frames from before again. The Focus Check
// overrides the moving Fixtures on the Outputs in both modes, at full unless
// Blackout is on. Freeze holds the beat that Effects run to, so they
// keep their offsets; turned off, they jump to where the beat has got to.
// Strobe runs on, at the Tempo as it is. Each movement Effect runs at a
// length held to keep it under the Speed limit (ADR 0015). None of this is
// part of the Show or the Venue Patch.
export function createPlayback({ emit, now, beat, bpm, show, patch }: PlaybackOptions) {
  let active: ActiveScenes = {};
  // By Layer id.
  const flashes = new Map<string, Flash>();
  let mode: PlaybackMode = 'monitor';
  let grandMaster = 1;
  let blackout = false;
  // The beat Effects hold while Freeze is on.
  let frozenBeat: number | undefined;
  let focusCheck: Direction | undefined;
  let sent = new Map<number, Uint8Array>();
  // By Rule index and Scene id, for the Scenes active or faded from.
  let held = new Map<string, HeldLength>();
  // The beat the held lengths were last updated at.
  let heldBeat: number | undefined;
  let runs: EffectRuns = {};
  let limited: LimitedByLayer = {};

  // Sends the playback as it is, the held lengths brought up to date.
  function emitPlayback(): void {
    refresh();
    const scenes: ActiveByLayer = Object.fromEntries(
      Object.entries(active).map(([id, a]) => [id, a.scene]),
    );
    emit({
      type: 'playback',
      active: scenes,
      mode,
      grandMaster,
      blackout,
      freeze: frozenBeat !== undefined,
      ...(focusCheck === undefined ? {} : { focusCheck }),
      ...(Object.keys(limited).length === 0 ? {} : { limited }),
    });
  }

  // Updates the length each movement Effect of the Scenes shown runs at, to
  // the shortest that keeps it under the Speed limit at the Tempo. An Effect
  // new to them takes it at once. One already running steps to it only on a
  // beat that is a whole multiple of the longer of the two lengths, where
  // both are at the same point in their cycle, Spread delays included, and
  // steps down only when well under the limit. Under Freeze, both hold.
  // Whether a Layer's limited length changed.
  function refresh(): boolean {
    const at = effectBeat();
    const tempo = bpm();
    const next = new Map<string, HeldLength>();
    const nextRuns: EffectRuns = {};
    for (const id of shownScenes()) {
      const scene = show().scenes.find((s) => s.id === id);
      for (const [index, { movementEffect: effect }] of (scene?.rules ?? []).entries()) {
        if (effect === undefined || effect === NO_EFFECT) continue;
        const key = `${index} ${id}`;
        const previous = held.get(key);
        let length: EffectLength;
        let size: number;
        if (frozenBeat !== undefined && previous && sameEffect(previous.effect, effect)) {
          ({ length, size } = previous);
        } else {
          const fit = fitSpeedLimit(effect, tempo);
          length = heldLength(previous, effect, fit.length, tempo, at);
          // At 16 beats and still too fast, the size shrinks to fit.
          size = length === fit.length ? fit.size : effect.size;
        }
        next.set(key, { effect, length, size });
        if (length !== effect.length || size !== effect.size) {
          (nextRuns[id] ??= {})[index] = { length, size };
        }
      }
    }
    held = next;
    heldBeat = at;
    runs = nextRuns;
    const was = limited;
    limited = {};
    for (const [layer, { scene }] of Object.entries(active)) {
      const lengths = Object.values(runs[scene] ?? {}).map((run) => run.length);
      if (lengths.length > 0) limited[layer] = Math.max(...lengths) as EffectLength;
    }
    return !sameLimited(was, limited);
  }

  // The length an Effect runs at now, held at `previous` until a switch to
  // `fit`, the length that fits at `tempo`, is due at `at`.
  function heldLength(
    previous: HeldLength | undefined,
    effect: MovementEffect,
    fit: EffectLength,
    tempo: number,
    at: number,
  ): EffectLength {
    if (!previous || !sameEffect(previous.effect, effect)) return fit;
    const target =
      fit >= previous.length
        ? fit
        : (Math.min(
            previous.length,
            fitSpeedLimit(effect, tempo, STEP_DOWN_LIMIT).length,
          ) as EffectLength);
    if (target === previous.length || heldBeat === undefined) return previous.length;
    const boundary = Math.max(target, previous.length);
    return Math.floor(heldBeat / boundary) === Math.floor(at / boundary) ? previous.length : target;
  }

  // The Scenes the Layers show, and those they still fade from.
  function shownScenes(): Set<string> {
    const ids = new Set<string>();
    for (const entry of Object.values(active)) {
      for (let e: ActiveScene | undefined = entry; e; e = e.from) ids.add(e.scene);
    }
    return ids;
  }

  // The Grand Master as resolved, Blackout included.
  function resolvedGrandMaster(): number {
    return blackout ? 0 : grandMaster;
  }

  function effectBeat(): number {
    return frozenBeat ?? beat();
  }

  function layerOf(sceneId: string): string | undefined {
    return show().scenes.find((s) => s.id === sceneId)?.layer;
  }

  function seconds(): number {
    return now() / 1000;
  }

  function go(from: ActiveScenes, sceneId: string): ActiveScenes {
    return activate(
      from,
      show(),
      patch(),
      sceneId,
      seconds(),
      resolvedGrandMaster(),
      effectBeat(),
      runs,
    );
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
        case 'setFreeze':
          if (command.on) frozenBeat ??= beat();
          else if (frozenBeat !== undefined) {
            frozenBeat = undefined;
            // The jump to where the beat has got to is no boundary to switch
            // lengths on; the next one is.
            heldBeat = beat();
          }
          break;
        case 'setFocusCheck':
          focusCheck = command.direction;
          break;
      }
      emitPlayback();
    },
    // The live look for an engine restart, without the Tempo. A held Flash
    // counts as its Scene.
    snapshot(): LiveLook {
      const order = Object.entries(active).sort(([, a], [, b]) => a.since - b.since);
      return {
        active: order.map(([layer, { scene }]) => ({ layer, scene })),
        mode,
        grandMaster,
        blackout,
        freeze: frozenBeat !== undefined,
      };
    },
    // Brings back the live look of an engine that stopped: its Scenes at
    // full, at once, stacked in the same order. Scenes no longer in their
    // Layer are left out. The Focus Check is off.
    restore(look: LiveLook): void {
      flashes.clear();
      const { scenes } = show();
      const kept = look.active.filter(({ layer, scene }) =>
        scenes.some((s) => s.id === scene && s.layer === layer),
      );
      // Activated long ago, so every fade is done, in the same order.
      const start = seconds() - RESTORED_AGE_S;
      active = Object.fromEntries(
        kept.map(({ layer, scene }, i) => [layer, { scene, since: start + i }]),
      );
      mode = look.mode;
      grandMaster = clamp(look.grandMaster) || 0;
      blackout = look.blackout;
      frozenBeat = look.freeze ? beat() : undefined;
      focusCheck = undefined;
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
    // Clears the active Scenes. Blackout and Freeze stay as they are.
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
      if (refresh()) emitPlayback();
      if (mode === 'monitor') {
        sent = resolveFrames(
          show(),
          patch(),
          active,
          seconds(),
          resolvedGrandMaster(),
          effectBeat(),
          bpm(),
          runs,
        );
      }
      let frames = sent;
      if (mode === 'blind' && blackout) {
        frames = resolveFrames(show(), patch(), active, seconds(), 0, effectBeat(), bpm(), runs);
      }
      if (focusCheck === undefined) return frames;
      return focusCheckFrames(patch(), frames, focusCheck, blackout ? 0 : 1);
    },
    // How each Fixture looks now, by Fixture id, in either mode. Resolved apart
    // from `frames`, so Blind can preview what it does not send. The Focus
    // Check shows as it is sent.
    lights(): Record<string, FixtureLight> {
      if (refresh()) emitPlayback();
      const lights = resolveLights(
        show(),
        patch(),
        active,
        seconds(),
        resolvedGrandMaster(),
        effectBeat(),
        bpm(),
        runs,
      );
      if (focusCheck === undefined) return lights;
      return focusCheckLights(patch(), lights, focusCheck, blackout ? 0 : 1);
    },
  };
}

// Whether two Effects run at the same speed.
function sameEffect(a: MovementEffect, b: MovementEffect): boolean {
  return a.shape === b.shape && a.size === b.size && a.length === b.length;
}

// Whether two reports of limited Layers say the same.
function sameLimited(a: LimitedByLayer, b: LimitedByLayer): boolean {
  const layers = Object.keys(a);
  return layers.length === Object.keys(b).length && layers.every((layer) => a[layer] === b[layer]);
}
