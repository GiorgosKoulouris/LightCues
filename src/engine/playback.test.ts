import { describe, expect, it } from 'vitest';
import type { Capability, Channel, FixtureProfile } from '../shared/fixture-profile';
import type { Rule, Scene, Show } from '../shared/show';
import type { VenuePatch } from '../shared/venue-patch';
import { createPlayback } from './playback';

function channel(name: string, capability: Capability): Channel {
  return { kind: 'control', name, defaultValue: 0, ranges: [{ from: 0, to: 255, capability }] };
}

const mover: FixtureProfile = {
  id: 'test/mover',
  manufacturer: 'Test',
  model: 'mover',
  defaultRole: 'Wash',
  modes: [
    {
      name: 'mode',
      channels: [
        channel('Dimmer', { type: 'intensity' }),
        channel('Pan', { type: 'pan', degrees: [-270, 270] }),
        channel('Tilt', { type: 'tilt', degrees: [-135, 135] }),
      ],
    },
  ],
};

// Hung 6 m up on Stage Left.
const rig: VenuePatch = {
  stage: { width: 12, depth: 9 },
  universes: [{ number: 1 }],
  fixtures: [
    {
      id: 'mover',
      name: 'Mover',
      profileId: mover.id,
      mode: 'mode',
      universe: 1,
      address: 1,
      x: 3,
      y: 4,
      height: 6,
    },
  ],
  profiles: [mover],
};

function scene(id: string, rule: Omit<Rule, 'target'>, fadeIn = 0): Scene {
  return { id, name: id, tags: [], layer: 'l1', fadeIn, rules: [{ target: {}, ...rule }] };
}

const show: Show = {
  layers: [{ id: 'l1', name: 'Layer 1' }],
  scenes: [
    scene('cross', { intensity: 1, direction: 'Cross' }),
    scene('out', { intensity: 1, direction: 'Out' }, 2),
    scene('up', { intensity: 1, direction: 'Up' }),
  ],
  triggers: [],
};

describe('playback', () => {
  function playback() {
    let ms = 0;
    const p = createPlayback({ emit: () => {}, now: () => ms, show: () => show, patch: () => rig });
    return {
      p,
      at: (seconds: number) => void (ms = seconds * 1000),
      // Pan and tilt of the mover.
      aim: () => [...p.frames().get(1)!.subarray(1, 3)],
    };
  }

  it('moves from the aim shown, to the pan nearest it', () => {
    const { p, at, aim } = playback();
    p.handle({ type: 'goScene', sceneId: 'cross' });
    at(10);
    p.handle({ type: 'goScene', sceneId: 'out' });

    at(11);
    expect(aim()).toEqual([187, 112]);
    at(12);
    // Pan 162°, nearer the 90° of Cross than -18°.
    expect(aim()).toEqual([204, 55]);
  });

  it('restores the aim from before a Flash at once on release', () => {
    const { p, at, aim } = playback();
    const flash = { channel: 1, note: 36 };
    p.handle({ type: 'goScene', sceneId: 'cross' });
    at(10);
    p.handle({ type: 'goScene', sceneId: 'out' });
    at(20);
    const before = aim();

    p.fire({ ...flash, scene: 'up', mode: 'flash' });
    expect(aim()).not.toEqual(before);
    at(21);
    p.noteOff(flash);

    expect(aim()).toEqual(before);
  });
});
