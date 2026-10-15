// The House Lights' output. They are kept apart from the Show: Scenes,
// Blackout, the Grand Master, Freeze and Blind never reach them.
import {
  DMX_CHANNELS,
  fixtureMode,
  FULL_WHITE,
  patchHouse,
  type HouseLook,
  type VenuePatch,
} from '../shared/venue-patch';
import { levelChannels } from './scene-resolution';

// The house state: what each House Group shows, by Group id. A previewed
// house look shows over it without changing it.
export function createHouse({ patch }: { patch: () => VenuePatch }) {
  let state: HouseLook = {};
  let previewed: HouseLook | undefined;

  return {
    // Goes to the Startup look, when a Venue Patch is opened or replaced.
    venueReplaced(): void {
      state = { ...patchHouse(patch()).startupLook };
    },
    // Shows `look` over the house state; without one, the house state again.
    preview(look: HouseLook | undefined): void {
      previewed = look;
    },
    // `stage` with the House Lights written over it.
    frames: (stage: Map<number, Uint8Array>): Map<number, Uint8Array> =>
      houseFrames(patch(), { ...state, ...previewed }, stage),
  };
}

// `stage`, the frames per Universe, with each House Light set as its Group is
// in `look`, or to full white. Returns new frames; `stage` is not changed.
export function houseFrames(
  patch: VenuePatch,
  look: HouseLook,
  stage: Map<number, Uint8Array>,
): Map<number, Uint8Array> {
  const { lights } = patchHouse(patch);
  if (lights.length === 0) return stage;
  const frames = new Map([...stage].map(([number, frame]) => [number, frame.slice()]));
  for (const light of lights) {
    const { intensity, colour } = Object.hasOwn(look, light.group)
      ? look[light.group]!
      : FULL_WHITE;
    const { channels } = fixtureMode(patch, light);
    let frame = frames.get(light.universe);
    if (!frame) frames.set(light.universe, (frame = new Uint8Array(DMX_CHANNELS)));
    frame.set(levelChannels(channels, intensity, colour), light.address - 1);
  }
  return frames;
}
