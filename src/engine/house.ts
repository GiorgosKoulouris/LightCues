// The House Lights' output. They are kept apart from the Show: Scenes,
// Blackout, the Grand Master, Freeze and Blind never reach them.
import type { EngineEvent, HouseFired, HouseSnapshot } from '../shared/protocol';
import { findHousePreset, type Show } from '../shared/show';
import {
  DMX_CHANNELS,
  fixtureMode,
  FULL_WHITE,
  houseLook,
  patchHouse,
  type HouseLook,
  type HouseSetting,
  type VenuePatch,
} from '../shared/venue-patch';
import {
  blend,
  clamp,
  colourLevels,
  lerp,
  levelChannels,
  type ColourLevels,
} from './scene-resolution';

// What a House Group shows: intensity 0–1 and its colour's levels.
export interface GroupLevel {
  intensity: number;
  colour: ColourLevels;
}

// Seconds the Startup look button crossfades over.
const STARTUP_FADE_S = 2;

// A House Group's crossfade from `from` to `setting`, started at `since`
// (seconds), over `fade` seconds.
interface GroupFade {
  from: GroupLevel;
  setting: HouseSetting;
  since: number;
  fade: number;
}

export interface HouseOptions {
  patch: () => VenuePatch;
  show: () => Show;
  // Milliseconds.
  now: () => number;
  emit: (event: EngineEvent) => void;
}

// The house state: what each House Group shows, by Group id, each fading on
// its own. A Group with none shows full white. Firing a look crossfades the
// Groups it sets from where they are; the others go on as they were. A
// previewed house look shows over the house state without changing it.
export function createHouse({ patch, show, now, emit }: HouseOptions) {
  let fades = new Map<string, GroupFade>();
  let fired: HouseFired = { type: 'startup' };
  // Made again on each change only, so an unchanged one is the same object.
  let snapshot: HouseSnapshot = { look: {}, fired };
  let previewed: HouseLook | undefined;

  function seconds(): number {
    return now() / 1000;
  }

  function levels(): Record<string, GroupLevel> {
    const time = seconds();
    return Object.fromEntries([...fades].map(([group, fade]) => [group, fadeLevel(fade, time)]));
  }

  function emitHouse(): void {
    emit({ type: 'house', fired });
  }

  // Records what was fired last and the new house state, and reports it.
  function record(last: HouseFired): void {
    fired = last;
    const look = Object.fromEntries([...fades].map(([group, { setting }]) => [group, setting]));
    snapshot = { look, fired };
    emitHouse();
  }

  // Goes to `look` at once, every fade done.
  function settle(look: HouseLook, last: HouseFired): void {
    fades = new Map(
      Object.entries(look).map(([group, setting]) => [
        group,
        { from: settingLevel(setting), setting, since: 0, fade: 0 },
      ]),
    );
    record(last);
  }

  function crossfade(look: HouseLook, fade: number, last: HouseFired): void {
    const current = levels();
    const since = seconds();
    fades = new Map(fades);
    for (const [group, setting] of Object.entries(look)) {
      const from = Object.hasOwn(current, group) ? current[group]! : WHITE_LEVEL;
      fades.set(group, { from, setting, since, fade });
    }
    record(last);
  }

  return {
    // Goes to the Startup look at once, when a Venue Patch is opened or
    // replaced.
    venueReplaced(): void {
      settle({ ...patchHouse(patch()).startupLook }, { type: 'startup' });
    },
    // Crossfades to the House Preset's look over its fade. Does nothing when
    // the Show lacks the House Preset or the Venue Patch has no look for it.
    fire(id: string): void {
      const preset = findHousePreset(show(), id);
      const look = preset && houseLook(patch(), id);
      if (!preset || !look) return;
      crossfade(look, preset.fade, { type: 'preset', id });
    },
    // Crossfades to the Startup look, the Groups it does not set to full
    // white, over STARTUP_FADE_S.
    goStartupLook(): void {
      const startup = patchHouse(patch()).startupLook ?? {};
      const groups = new Set([...fades.keys(), ...Object.keys(startup)]);
      const look = Object.fromEntries(
        [...groups].map((group) => [
          group,
          Object.hasOwn(startup, group) ? startup[group]! : FULL_WHITE,
        ]),
      );
      crossfade(look, STARTUP_FADE_S, { type: 'startup' });
    },
    // Shows `look` over the house state; without one, the house state again.
    preview(look: HouseLook | undefined): void {
      previewed = look;
    },
    emitHouse,
    // The house state for an engine restart: where each Group is going.
    snapshot: (): HouseSnapshot => snapshot,
    // Brings back the house state of an engine that stopped, fades done.
    restore({ look, fired: last }: HouseSnapshot): void {
      settle(look, last);
    },
    // `stage` with the House Lights written over it.
    frames: (stage: Map<number, Uint8Array>): Map<number, Uint8Array> =>
      houseFrames(patch(), { ...levels(), ...houseLevels(previewed ?? {}) }, stage),
  };
}

const WHITE_LEVEL = settingLevel(FULL_WHITE);

function settingLevel({ intensity, colour }: HouseSetting): GroupLevel {
  return { intensity, colour: colourLevels(colour) };
}

// What a Group fading as `fade` shows at `time` (seconds).
function fadeLevel({ from, setting, since, fade }: GroupFade, time: number): GroupLevel {
  const p = fade > 0 ? clamp((time - since) / fade) : 1;
  const to = settingLevel(setting);
  return {
    intensity: lerp(from.intensity, to.intensity, p),
    colour: blend(from.colour, to.colour, p),
  };
}

// The levels of a house look, by House Group id.
export function houseLevels(look: HouseLook): Record<string, GroupLevel> {
  return Object.fromEntries(
    Object.entries(look).map(([group, setting]) => [group, settingLevel(setting)]),
  );
}

// `stage`, the frames per Universe, with each House Light set as its Group is
// in `levels`, or to full white. Returns new frames; `stage` is not changed.
export function houseFrames(
  patch: VenuePatch,
  levels: Record<string, GroupLevel>,
  stage: Map<number, Uint8Array>,
): Map<number, Uint8Array> {
  const { lights } = patchHouse(patch);
  if (lights.length === 0) return stage;
  const frames = new Map([...stage].map(([number, frame]) => [number, frame.slice()]));
  for (const light of lights) {
    const { intensity, colour } = Object.hasOwn(levels, light.group)
      ? levels[light.group]!
      : WHITE_LEVEL;
    const { channels } = fixtureMode(patch, light);
    let frame = frames.get(light.universe);
    if (!frame) frames.set(light.universe, (frame = new Uint8Array(DMX_CHANNELS)));
    frame.set(levelChannels(channels, intensity, colour), light.address - 1);
  }
  return frames;
}
