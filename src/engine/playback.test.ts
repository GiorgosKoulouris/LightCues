import { describe, expect, it } from 'vitest';
import type { Capability, Channel, FixtureProfile } from '../shared/fixture-profile';
import type { EngineEvent } from '../shared/protocol';
import { SPEED_LIMIT, type MovementEffect, type Rule, type Scene, type Show } from '../shared/show';
import type { VenuePatch } from '../shared/venue-patch';
import { createPlayback } from './playback';
import { activate, resolveFrames, resolveLights } from './scene-resolution';
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
        channel('Strobe', { type: 'strobe', hz: [1, 25] }),
      ],
    },
  ],
};

const par: FixtureProfile = {
  id: 'test/par',
  manufacturer: 'Test',
  model: 'par',
  defaultRole: 'Wash',
  modes: [
    {
      name: 'mode',
      channels: [
        channel('Red', { type: 'emitter', emitter: 'red' }),
        channel('Green', { type: 'emitter', emitter: 'green' }),
        channel('Blue', { type: 'emitter', emitter: 'blue' }),
      ],
    },
  ],
};

// A mover hung 6 m up on Stage Left, and an RGB par.
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
    {
      id: 'par',
      name: 'Par',
      profileId: par.id,
      mode: 'mode',
      universe: 1,
      address: 11,
      x: -3,
      y: 1,
      height: 0,
    },
  ],
  profiles: [mover, par],
};

function scene(id: string, rule: Omit<Rule, 'target'>, fadeIn = 0, layer = 'l1'): Scene {
  return { id, name: id, tags: [], layer, fadeIn, rules: [{ target: {}, ...rule }] };
}

// A Pan sweep of 10° over 1/4 beat, changed by `overrides`.
function fast(overrides: Partial<MovementEffect> = {}): MovementEffect {
  return { shape: 'Pan sweep', size: 10, length: 0.25, spread: 'In sync', ...overrides };
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
      movementEffect: { shape: 'Pan sweep', size: 10, length: 4, spread: 'In sync' },
    }),
    scene('centre', { direction: 'Centre' }, 0, 'l2'),
    // Over the limit at 1/4 beat from about 72 BPM, at 1/2 from about 143.
    scene('fast', { intensity: 1, direction: 'Cross', movementEffect: fast() }),
    // Too fast even at 16 beats from about 255 BPM.
    scene('wide', {
      intensity: 1,
      direction: 'Cross',
      movementEffect: fast({ size: 180, length: 16 }),
    }),
    scene('fast spread', {
      intensity: 1,
      direction: 'Cross',
      movementEffect: fast({ spread: 'Left→Right' }),
    }),
    scene('strobe', { intensity: 1, strobe: 0.25 }),
    scene('ramp', {
      intensity: 1,
      intensityEffect: { shape: 'Ramp up', depth: 1, length: 4, spread: 'In sync' },
    }),
    scene('red blue', {
      intensity: 1,
      colourEffect: {
        shape: 'Step',
        colours: [{ swatch: 'Red' }, { swatch: 'Blue' }],
        length: 4,
        spread: 'In sync',
      },
    }),
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
      bpm: tempo.bpm,
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
      // The mover's intensity in the preview.
      intensity: () => p.lights().mover!.intensity,
      // The par's red, green and blue in the preview.
      colour: () => {
        const { red, green, blue } = p.lights().par!;
        return [red, green, blue];
      },
      // The mover's strobe channel, and its rate in the preview.
      strobe: () => [p.frames().get(1)![3], p.lights().mover!.strobe],
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

    it('holds an intensity Effect at its level while on, then resumes with the beat', () => {
      const { p, at, intensity } = playback();
      p.handle({ type: 'goScene', sceneId: 'ramp' });
      // Beat 1 of a 4-beat ramp.
      at(0.5);
      p.handle({ type: 'setFreeze', on: true });

      at(1.5);
      expect(intensity()).toBeCloseTo(0.25);
      p.handle({ type: 'setFreeze', on: false });
      // Beat 3.
      expect(intensity()).toBeCloseTo(0.75);
    });

    it('holds a colour Effect at its colour while on, then resumes with the beat', () => {
      const { p, at, colour } = playback();
      p.handle({ type: 'goScene', sceneId: 'red blue' });
      // Beat 1 of 4: red.
      at(0.5);
      p.handle({ type: 'setFreeze', on: true });

      at(1.5);
      expect(colour()).toEqual([1, 0, 0]);
      p.handle({ type: 'setFreeze', on: false });
      // Beat 3: blue.
      expect(colour()).toEqual([0, 0, 1]);
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

    it('does not hold strobe, whose beat rate follows the Tempo', () => {
      const { p, tempo, at, strobe } = playback();
      p.handle({ type: 'goScene', sceneId: 'strobe' });
      p.handle({ type: 'setFreeze', on: true });

      // A 1/4 beat at 120 BPM: 8 Hz, 7/24 of the way across 1–25 Hz.
      at(1);
      expect(strobe()).toEqual([74, 8]);
      // Taps 0.4 s apart: 150 BPM, so 10 Hz.
      tempo.tap();
      at(1.4);
      tempo.tap();
      expect(strobe()).toEqual([96, 10]);
    });

    it('is reported with the playback, off at first', () => {
      const events: unknown[] = [];
      const p = createPlayback({
        emit: (e) => events.push(e),
        now: () => 0,
        beat: () => 0,
        bpm: () => 120,
        show: () => show,
        patch: () => rig,
      });
      p.handle({ type: 'getPlayback' });
      p.handle({ type: 'setFreeze', on: true });

      expect(events).toMatchObject([{ freeze: false }, { freeze: true }]);
    });
  });
});

describe('Speed limit', () => {
  // Two movers, Stage Left and Stage Right.
  const pair: VenuePatch = {
    ...rig,
    fixtures: [
      rig.fixtures[0]!,
      { ...rig.fixtures[0]!, id: 'other', name: 'Other', address: 21, x: -3 },
    ],
  };

  // Playback at a beat and Tempo set by hand, 120 BPM at first.
  function playback(patch = rig) {
    let ms = 0;
    let beat = 0;
    let bpm = 120;
    const events: EngineEvent[] = [];
    const p = createPlayback({
      emit: (event) => events.push(event),
      now: () => ms,
      beat: () => beat,
      bpm: () => bpm,
      show: () => show,
      patch: () => patch,
    });
    const pans = () =>
      Object.values(p.lights()).flatMap(({ aim }) => (aim?.pan === undefined ? [] : [aim.pan]));
    const cross = resolveLights(show, patch, activate({}, show, patch, 'cross', 0), 0).mover!.aim!;
    return {
      p,
      events,
      setBpm: (to: number) => void (bpm = to),
      // The mover's pan from its Cross aim, in degrees.
      offset: () => p.lights().mover!.aim!.pan! - cross.pan!,
      // Runs the beat on to `to` at the Tempo, a frame each 1/100 beat. The
      // fastest any mover's pan moved, in degrees per second.
      run(to: number): number {
        let fastest = 0;
        let last = pans();
        while (beat < to - 1e-9) {
          const step = Math.min(0.01, to - beat);
          const seconds = (step * 60) / bpm;
          beat += step;
          ms += seconds * 1000;
          p.frames();
          const next = pans();
          for (const [i, pan] of next.entries()) {
            fastest = Math.max(fastest, Math.abs(pan - last[i]!) / seconds);
          }
          last = next;
        }
        return fastest;
      },
    };
  }

  // The offset a 10° Pan sweep over `length` beats gives at `beat`.
  function sweep(length: number, beat: number): number {
    return 10 * Math.sin((2 * Math.PI * beat) / length);
  }

  // What each `playback` event said was limited, by Layer.
  function limits(events: EngineEvent[]) {
    return events.flatMap((e) => (e.type === 'playback' ? [e.limited] : []));
  }

  it('limits a Scene started at a high Tempo from its first frame', () => {
    const { p, run, offset } = playback();
    p.handle({ type: 'goScene', sceneId: 'fast' });

    // At 1/2 beat: a quarter cycle on at beat 0.125, where 1/4 would be back
    // at 0.
    run(0.125);
    expect(offset()).toBeCloseTo(sweep(0.5, 0.125));
    expect(run(4)).toBeLessThanOrEqual(SPEED_LIMIT);
  });

  it('switches to a longer length only at its boundary, with no jump, Spread included', () => {
    const { p, setBpm, run, offset } = playback(pair);
    setBpm(60);
    p.handle({ type: 'goScene', sceneId: 'fast spread' });
    run(0.3);
    setBpm(120);

    // Still 1/4 until beat 0.5, the next boundary of 1/2. The mover is
    // second from Stage Right, half a cycle behind.
    run(0.45);
    expect(offset()).toBeCloseTo(-sweep(0.25, 0.45));
    // No step bigger than the 1/4 sweep at 120 BPM makes, about 500°/s.
    expect(run(0.55)).toBeLessThan(2 * SPEED_LIMIT);
    expect(offset()).toBeCloseTo(-sweep(0.5, 0.55));
    expect(run(4)).toBeLessThanOrEqual(SPEED_LIMIT);
  });

  it('does not flip back while the Tempo hovers just under the limit', () => {
    const { p, setBpm, run, offset } = playback();
    setBpm(80);
    p.handle({ type: 'goScene', sceneId: 'fast' });
    run(1);

    // 1/4 fits from about 72 BPM down, but is over 90% of the limit until
    // about 64 BPM.
    let at = 1;
    for (const bpm of [70, 68, 71, 66, 69]) {
      setBpm(bpm);
      at += 2;
      run(at + 0.125);
      expect(offset()).toBeCloseTo(sweep(0.5, 0.125));
    }
  });

  it('switches back down at the next boundary once clearly under the limit', () => {
    const { p, setBpm, run, offset } = playback();
    p.handle({ type: 'goScene', sceneId: 'fast' });
    run(0.3);
    setBpm(60);

    run(0.45);
    expect(offset()).toBeCloseTo(sweep(0.5, 0.45));
    expect(run(0.55)).toBeLessThanOrEqual(SPEED_LIMIT);
    expect(offset()).toBeCloseTo(sweep(0.25, 0.55));
  });

  it('holds under Freeze, then resumes and switches at the next boundary', () => {
    const { p, setBpm, run, offset } = playback();
    p.handle({ type: 'goScene', sceneId: 'fast' });
    run(0.1);
    p.handle({ type: 'setFreeze', on: true });
    const held = offset();
    setBpm(200);
    run(3.3);
    expect(offset()).toBeCloseTo(held);

    p.handle({ type: 'setFreeze', on: false });
    // Where the beat has got to, still at 1/2 until beat 4, the next boundary
    // of 1 beat.
    expect(offset()).toBeCloseTo(sweep(0.5, 3.3));
    run(4.2);
    expect(offset()).toBeCloseTo(sweep(1, 4.2));
  });

  it('holds a shrunk size under Freeze when the Tempo changes', () => {
    const { p, setBpm, run, offset } = playback();
    setBpm(400);
    p.handle({ type: 'goScene', sceneId: 'wide' });
    run(3);
    p.handle({ type: 'setFreeze', on: true });
    const held = offset();
    setBpm(600);
    run(4);
    expect(offset()).toBeCloseTo(held);
    setBpm(120);
    run(5);
    expect(offset()).toBeCloseTo(held);
  });

  it('reports a limited Layer in the playback event, when that changes', () => {
    const { p, events, setBpm, run } = playback();
    p.handle({ type: 'goScene', sceneId: 'fast' });
    run(2);
    setBpm(60);
    run(4);

    expect(limits(events)).toEqual([{ l1: 0.5 }, undefined]);
  });

  it('runs an Effect under the limit as before', () => {
    const { p, run } = playback();
    p.handle({ type: 'goScene', sceneId: 'sweep' });
    const active = activate({}, show, rig, 'sweep', 0);

    for (let beat = 0; beat < 8; beat += 0.5) {
      run(beat);
      const before = resolveFrames(show, rig, active, (beat * 60) / 120, 1, beat, 120);
      expect(p.frames()).toEqual(before);
    }
  });
});
