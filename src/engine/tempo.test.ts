import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineEvent, TempoSource } from '../shared/protocol';
import { createTempo } from './tempo';

// A Tempo on a fake clock. `at(ms)` moves the time; `clock(bpm, beats)` sends
// that many beats of MIDI Clock ticks from now, at `bpm`.
function tempoAt() {
  let time = 0;
  const events: EngineEvent[] = [];
  const tempo = createTempo({ now: () => time, emit: (e) => events.push(e) });
  return {
    tempo,
    events,
    at: (ms: number) => void (time = ms),
    time: () => time,
    clock(bpm: number, beats: number) {
      const interval = 60000 / bpm / 24;
      for (let i = 0; i < beats * 24; i++) {
        tempo.clockTick();
        time += interval;
      }
    },
    tap(...times: number[]) {
      for (const t of times) {
        time = t;
        tempo.tap();
      }
    },
    // The last Tempo reported.
    reported(): { bpm: number; source: TempoSource } | undefined {
      const last = events.findLast((e) => e.type === 'tempo');
      return last?.type === 'tempo' ? { bpm: last.bpm, source: last.source } : undefined;
    },
  };
}

describe('Tempo', () => {
  // For the clock's timeout. The Tempo reads the time from `at`.
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is 120 BPM before any clock or tap', () => {
    const { tempo } = tempoAt();
    expect(tempo.bpm()).toBe(120);
  });

  it('reports itself on request', () => {
    const t = tempoAt();
    t.tempo.emitTempo();
    expect(t.reported()).toEqual({ bpm: 120, source: 'default' });
  });

  describe('MIDI Clock', () => {
    it('sets the Tempo from 24 ticks per beat', () => {
      const t = tempoAt();
      t.clock(128, 3);
      expect(t.tempo.bpm()).toBeCloseTo(128, 6);
      expect(t.reported()?.source).toBe('clock');
    });

    it('reports a steady clock once, not on every beat', () => {
      const t = tempoAt();
      t.clock(128, 8);
      expect(t.events.filter((e) => e.type === 'tempo')).toHaveLength(1);
    });

    it('waits for a whole beat of ticks', () => {
      const t = tempoAt();
      t.clock(90, 0.5);
      expect(t.tempo.bpm()).toBe(120);
      expect(t.reported()).toBeUndefined();
    });

    it('smooths jitter over the last beats', () => {
      const t = tempoAt();
      const interval = 60000 / 100 / 24;
      for (let i = 0; i < 24 * 4; i++) {
        // ±3 ms jitter around a steady 100 BPM.
        t.at(i * interval + (i % 2 === 0 ? 3 : -3));
        t.tempo.clockTick();
      }
      expect(t.tempo.bpm()).toBeCloseTo(100, 0);
    });

    it('follows a change of tempo within a few beats', () => {
      const t = tempoAt();
      t.clock(100, 4);
      t.clock(140, 5);
      expect(t.tempo.bpm()).toBeCloseTo(140, 6);
    });

    it('holds the last Tempo when the clock stops arriving, and says so', () => {
      const t = tempoAt();
      t.clock(128, 4);
      vi.advanceTimersByTime(499);
      expect(t.reported()?.source).toBe('clock');
      vi.advanceTimersByTime(1);
      expect(t.reported()).toEqual({ bpm: t.tempo.bpm(), source: 'held' });
      expect(t.tempo.bpm()).toBeCloseTo(128, 6);
    });

    it('takes over again a beat after the clock returns', () => {
      const t = tempoAt();
      t.clock(128, 4);
      vi.advanceTimersByTime(500);
      t.at(t.time() + 5000);
      t.clock(128, 1);
      expect(t.reported()?.source).toBe('held');
      t.clock(128, 0.1);
      expect(t.reported()?.source).toBe('clock');
    });

    it('keeps a tapped Tempo when the clock stops', () => {
      const t = tempoAt();
      t.clock(120, 2);
      t.tap(t.time() + 1, t.time() + 301);
      vi.advanceTimersByTime(1000);
      expect(t.reported()?.source).toBe('tap');
    });

    it('starts over after a gap, so the gap does not count', () => {
      const t = tempoAt();
      t.clock(128, 4);
      t.at(t.time() + 5000);
      t.clock(90, 0.5);
      expect(t.tempo.bpm()).toBeCloseTo(128, 6);
      t.clock(90, 1);
      expect(t.tempo.bpm()).toBeCloseTo(90, 6);
    });
  });

  describe('Tap Tempo', () => {
    it('sets the Tempo from the average of the last taps', () => {
      const t = tempoAt();
      t.tap(1000, 1500, 2000, 2490);
      // 1490 ms over three beats.
      expect(t.tempo.bpm()).toBeCloseTo(180000 / 1490, 6);
      expect(t.reported()?.source).toBe('tap');
    });

    it('needs two taps', () => {
      const t = tempoAt();
      t.tap(1000);
      expect(t.tempo.bpm()).toBe(120);
      expect(t.reported()).toBeUndefined();
    });

    it('averages only the last few taps', () => {
      const t = tempoAt();
      // Slow at first, then steady at 150 BPM (400 ms) for the last five.
      t.tap(0, 1000, 2000, 2400, 2800, 3200, 3600);
      expect(t.tempo.bpm()).toBeCloseTo(150, 6);
    });

    it('starts over after a 2 s gap', () => {
      const t = tempoAt();
      t.tap(0, 500, 1000);
      t.tap(3100);
      expect(t.tempo.bpm()).toBeCloseTo(120, 6);
      t.tap(3400);
      expect(t.tempo.bpm()).toBeCloseTo(200, 6);
    });

    it('overrides the clock until its next beat', () => {
      const t = tempoAt();
      // Steady 120 BPM ticks, 500 ms a beat; tick 96 is a beat.
      const interval = 500 / 24;
      let next = 0;
      const ticksTo = (last: number) => {
        for (; next <= last; next++) {
          t.at(next * interval);
          t.tempo.clockTick();
        }
      };
      ticksTo(96);
      t.tap(2001);
      ticksTo(108);
      t.tap(2251);
      expect(t.tempo.bpm()).toBeCloseTo(240, 6);
      expect(t.reported()?.source).toBe('tap');
      // Ticks within the beat leave the tap's Tempo.
      ticksTo(119);
      expect(t.tempo.bpm()).toBeCloseTo(240, 6);
      ticksTo(120);
      expect(t.tempo.bpm()).toBeCloseTo(120, 6);
      expect(t.reported()?.source).toBe('clock');
    });
  });

  describe('beat phase', () => {
    it('counts beats at the Tempo', () => {
      const t = tempoAt();
      t.at(1250);
      expect(t.tempo.beat()).toBeCloseTo(2.5, 6);
    });

    it('stays continuous when the Tempo changes', () => {
      const t = tempoAt();
      t.clock(120, 2);
      const before = t.tempo.beat();
      t.clock(60, 1);
      expect(t.tempo.beat()).toBeGreaterThan(before);
    });

    it('puts the last tap on a beat', () => {
      const t = tempoAt();
      t.tap(1100, 1600);
      expect(t.tempo.beat() % 1).toBeCloseTo(0, 6);
      t.at(1600 + 125);
      expect(t.tempo.beat() % 1).toBeCloseTo(0.25, 6);
    });

    it('puts each clock beat on a beat', () => {
      const t = tempoAt();
      t.at(130);
      // Ends on the time of the clock's next beat.
      t.clock(100, 3);
      expect(t.tempo.beat() % 1).toBeCloseTo(0, 6);
    });
  });
});
