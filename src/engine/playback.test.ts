import { describe, expect, it } from 'vitest';
import type { Capability, Channel, FixtureProfile } from '../shared/fixture-profile';
import type { Rule, Scene, Show } from '../shared/show';
import type { VenuePatch } from '../shared/venue-patch';
import { createPlayback } from './playback';
import { createTempo } from './tempo';

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

function scene(id: string, rule: Omit<Rule, 'target'>, fadeIn = 0, layer = 'l1'): Scene {
  return { id, name: id, tags: [], layer, fadeIn, rules: [{ target: {}, ...rule }] };
}

const show: Show = {
  layers: [
    { id: 'l1', name: 'Layer 1' },
    { id: 'l2', name: 'Layer 2' },
  ],
  scenes: [
    scene('cross', { intensity: 1, direction: 'Cross' }),
    scene('out', { intensity: 1, direction: 'Out' }, 2),
    scene('up', { intensity: 1, direction: 'Up' }),
    scene('sweep', {
      intensity: 1,
      direction: 'Cross',
      effect: { shape: 'Pan sweep', size: 10, length: 4, spread: 'In sync' },
    }),
    scene('centre', { direction: 'Centre' }, 0, 'l2'),
  ],
  triggers: [],
};

describe('playback', () => {
  // Runs to a real Tempo, at 120 BPM until tapped.
  function playback() {
    let ms = 0;
    const now = () => ms;
    const tempo = createTempo({ now, emit: () => {} });
    const p = createPlayback({
      emit: () => {},
      now,
      beat: tempo.beat,
      show: () => show,
      patch: () => rig,
    });
    return {
      p,
      tempo,
      at: (seconds: number) => void (ms = seconds * 1000),
      // The mover's pan in the preview, in degrees.
      pan: () => p.lights().mover!.aim!.pan!,
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

  it('runs movement Effects to the Tempo, in the Outputs and the preview', () => {
    const { p, at, aim, pan } = playback();
    p.handle({ type: 'goScene', sceneId: 'sweep' });

    // 120 BPM: a beat each half second, a cycle of 4 beats each 2 s.
    at(0.5);
    expect(pan()).toBeCloseTo(100);
    // Pan 100° of ±270°: 0.685 of the range.
    expect(aim()[0]).toBe(175);
    at(1.5);
    expect(pan()).toBeCloseTo(80);
  });

  it('keeps Effects in phase when the Tempo changes', () => {
    const { p, tempo, at, pan } = playback();
    p.handle({ type: 'goScene', sceneId: 'sweep' });
    at(2);
    tempo.tap();
    at(2.4);
    // Beat 4.8 at 120 BPM, nearly a quarter cycle on.
    expect(pan()).toBeCloseTo(99.5, 1);
    // Taps 0.4 s apart: 150 BPM, and the count put on the nearest beat, 5.
    tempo.tap();
    expect(pan()).toBeCloseTo(100);

    // A beat each 0.4 s from there.
    at(2.8);
    expect(pan()).toBeCloseTo(90);
    at(3.2);
    expect(pan()).toBeCloseTo(80);
  });

  describe('Freeze', () => {
    it('holds every movement Effect at its offset while on', () => {
      const { p, at, pan } = playback();
      p.handle({ type: 'goScene', sceneId: 'sweep' });
      at(0.5);
      p.handle({ type: 'setFreeze', on: true });

      at(1.5);
      expect(pan()).toBeCloseTo(100);
      at(7.25);
      expect(pan()).toBeCloseTo(100);
    });

    it('keeps applying Directions around the held offset', () => {
      const { p, at, pan } = playback();
      p.handle({ type: 'goScene', sceneId: 'centre' });
      const centre = pan();
      p.handle({ type: 'goScene', sceneId: 'sweep' });
      at(0.5);
      p.handle({ type: 'setFreeze', on: true });

      // Centre, set last, wins the Direction; the sweep's offset still holds.
      at(3);
      p.handle({ type: 'goScene', sceneId: 'centre' });
      expect(pan()).toBeCloseTo(centre + 10);
    });

    it('fades to a Direction on the same Layer while frozen', () => {
      const { p, at, pan, aim } = playback();
      p.handle({ type: 'goScene', sceneId: 'sweep' });
      at(0.5);
      p.handle({ type: 'setFreeze', on: true });
      const held = pan();
      // Out has no Effect, so the held offset fades out with the move.
      p.handle({ type: 'goScene', sceneId: 'out' });
      at(1.5);
      expect(pan()).not.toBeCloseTo(held);

      // Out as reached from Cross, with no offset left.
      at(2.5);
      expect(aim()).toEqual([204, 55]);
    });

    it('resumes where the beat has got to when turned off', () => {
      const { p, at, pan } = playback();
      p.handle({ type: 'goScene', sceneId: 'sweep' });
      at(0.5);
      p.handle({ type: 'setFreeze', on: true });
      at(1.5);
      p.handle({ type: 'setFreeze', on: false });

      // Beat 3: three quarters of a cycle, where it would have been.
      expect(pan()).toBeCloseTo(80);
    });

    it('is reported with the playback, off at first', () => {
      const events: unknown[] = [];
      const p = createPlayback({
        emit: (e) => events.push(e),
        now: () => 0,
        beat: () => 0,
        show: () => show,
        patch: () => rig,
      });
      p.handle({ type: 'getPlayback' });
      p.handle({ type: 'setFreeze', on: true });

      expect(events).toMatchObject([{ freeze: false }, { freeze: true }]);
    });
  });
});
