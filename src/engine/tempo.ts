import type { EngineEvent, TempoSource } from '../shared/protocol';

const DEFAULT_BPM = 120;
// MIDI Clock sends 24 ticks per beat.
const TICKS_PER_BEAT = 24;
// The clock's Tempo is averaged over this many beats of ticks.
const CLOCK_BEATS = 4;
// Longer between ticks, the clock has stopped: its Tempo is held, and
// counting starts over when it returns.
const CLOCK_GAP_MS = 500;
// Taps averaged, and the gap after which a tap starts over.
const TAPS = 5;
const TAP_GAP_MS = 2000;

interface TempoOptions {
  // Milliseconds.
  now: () => number;
  emit: (event: EngineEvent) => void;
}

// The Tempo and a beat count that Effects run to. MIDI Clock sets the Tempo on
// each of its beats, from the ticks of the last few beats. Tap Tempo sets it
// from the last taps, until the clock's next beat. When the clock stops, the
// last Tempo holds and is reported as held. The beat count stays continuous when the Tempo changes,
// and is put on a whole beat by each clock beat and each setting tap.
export function createTempo({ now, emit }: TempoOptions) {
  let bpm = DEFAULT_BPM;
  let source: TempoSource = 'default';
  // The beat count `beat` at time `at`, from which it runs at `bpm`.
  let anchor = { at: now(), beat: 0 };
  // Since the clock last started, the latest last.
  let ticks: number[] = [];
  let tickCount = 0;
  let taps: number[] = [];
  let clockStopped: ReturnType<typeof setTimeout> | undefined;

  function beatAt(time: number): number {
    return anchor.beat + ((time - anchor.at) * bpm) / 60000;
  }

  // Sets the Tempo at `time`, which is on a beat. Reported only when it shows
  // a change, since the clock sets it on every beat.
  function set(time: number, newBpm: number, newSource: TempoSource): void {
    anchor = { at: time, beat: Math.round(beatAt(time)) };
    const changed = newSource !== source || Math.round(newBpm * 10) !== Math.round(bpm * 10);
    bpm = newBpm;
    source = newSource;
    if (changed) emitTempo();
  }

  function emitTempo(): void {
    emit({ type: 'tempo', bpm, source });
  }

  return {
    bpm: () => bpm,
    // Beats counted at the Tempo; the fraction is how far into the beat.
    beat: () => beatAt(now()),
    clockTick(): void {
      const time = now();
      const last = ticks.at(-1);
      if (last !== undefined && time - last > CLOCK_GAP_MS) {
        ticks = [];
        tickCount = 0;
      }
      clearTimeout(clockStopped);
      clockStopped = setTimeout(() => {
        if (source !== 'clock') return;
        source = 'held';
        emitTempo();
      }, CLOCK_GAP_MS);
      ticks.push(time);
      if (ticks.length > CLOCK_BEATS * TICKS_PER_BEAT + 1) ticks.shift();
      if (tickCount++ % TICKS_PER_BEAT !== 0 || ticks.length < 2) return;
      const span = time - ticks[0]!;
      if (span > 0) set(time, (60000 * (ticks.length - 1)) / TICKS_PER_BEAT / span, 'clock');
    },
    tap(): void {
      const time = now();
      const last = taps.at(-1);
      if (last !== undefined && time - last > TAP_GAP_MS) taps = [];
      taps.push(time);
      if (taps.length > TAPS) taps.shift();
      const span = time - taps[0]!;
      if (span > 0) set(time, (60000 * (taps.length - 1)) / span, 'tap');
    },
    emitTempo,
  };
}
