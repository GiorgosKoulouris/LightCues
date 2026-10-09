import { describe, expect, it } from 'vitest';
import type { EngineSnapshot, RestoreResult } from '../shared/protocol';
import { superviseEngine, type EngineProcess } from './engine-supervisor';

// A stand-in for a forked engine: records what main posts, and lets a test
// send messages from it or end it.
function fakeEngine() {
  const listeners: Record<'message' | 'exit', ((value: unknown) => void)[]> = {
    message: [],
    exit: [],
  };
  const posted: unknown[] = [];
  const process: EngineProcess = {
    on(event: 'message' | 'exit', listener: (value: never) => void) {
      listeners[event].push(listener as (value: unknown) => void);
    },
    postMessage: (message) => void posted.push(message),
  };
  return {
    process,
    posted,
    send: (message: unknown) => listeners.message.forEach((l) => l(message)),
    exit: (code = 1) => listeners.exit.forEach((l) => l(code)),
  };
}

const snapshot: EngineSnapshot = {
  show: {
    document: { layers: [{ id: 'layer-1', name: 'Layer 1' }], scenes: [], triggers: [] },
    path: 'C:/gigs/tour.lcshow',
    unsaved: true,
  },
  venue: {
    document: {
      stage: { width: 10, depth: 8 },
      universes: [{ number: 1 }],
      fixtures: [],
      profiles: [],
    },
    unsaved: false,
  },
  playback: {
    active: [{ layer: 'layer-1', scene: 'wash' }],
    mode: 'monitor',
    grandMaster: 0.8,
    blackout: false,
    freeze: false,
    bpm: 128,
    tempoSource: 'tap',
  },
  midiInput: { selected: 'Pads' },
};

function supervised() {
  const engines: ReturnType<typeof fakeEngine>[] = [];
  const clock = { now: 0 };
  const log: string[] = [];
  const connected: EngineProcess[] = [];
  const results: RestoreResult[] = [];
  let downs = 0;
  const supervisor = superviseEngine({
    start: () => {
      const engine = fakeEngine();
      engines.push(engine);
      return engine.process;
    },
    now: () => clock.now,
    log: (line) => void log.push(line),
    connect: (engine) => void connected.push(engine),
    restarted: (result) => void results.push(result),
    down: () => void downs++,
  });
  return {
    supervisor,
    engines,
    clock,
    log,
    connected,
    results,
    downs: () => downs,
    latest: () => engines.at(-1)!,
  };
}

describe('superviseEngine', () => {
  it('does not restart an engine that exits while the app quits', () => {
    const { supervisor, engines, latest } = supervised();

    supervisor.quitting();
    latest().exit(0);

    expect(engines).toHaveLength(1);
  });

  it('restarts after an unexpected exit: grants, restore, then the window port', () => {
    const { supervisor, engines, connected, log, latest } = supervised();
    latest().send({ type: 'snapshot', ...snapshot });
    supervisor.granted('C:/gigs/tour.lcshow');
    supervisor.granted('C:/gigs/club.lcvenue');

    latest().exit(3);

    expect(engines).toHaveLength(2);
    expect(latest().posted).toEqual([
      { type: 'grantPath', path: 'C:/gigs/tour.lcshow' },
      { type: 'grantPath', path: 'C:/gigs/club.lcvenue' },
      { type: 'restore', snapshot },
    ]);
    expect(connected).toEqual([latest().process]);
    expect(supervisor.current()).toBe(latest().process);
    expect(log).toContain('Restarting the engine');
  });

  it('reports and logs the restore result', () => {
    const { results, log, latest } = supervised();
    latest().send({ type: 'snapshot', ...snapshot });
    latest().exit();

    latest().send({ type: 'restored', result: 'baseLook' });

    expect(results).toEqual(['baseLook']);
    expect(log).toContain('Engine restore result: baseLook');
  });

  it('restores the latest of each part', () => {
    const { latest } = supervised();
    latest().send({ type: 'snapshot', ...snapshot });
    latest().send({ type: 'snapshot', playback: { ...snapshot.playback, grandMaster: 0.2 } });
    latest().send({ type: 'snapshot', midiInput: {} });

    latest().exit();

    expect(latest().posted).toEqual([
      {
        type: 'restore',
        snapshot: {
          ...snapshot,
          playback: { ...snapshot.playback, grandMaster: 0.2 },
          midiInput: {},
        },
      },
    ]);
  });

  it('restarts without a restore when no whole snapshot came, and says so', () => {
    const { results, latest, engines } = supervised();
    latest().send({ type: 'snapshot', midiInput: {} });

    latest().exit();

    expect(engines).toHaveLength(2);
    expect(latest().posted).toEqual([]);
    expect(results).toEqual(['empty']);
  });

  it('keeps the snapshot and grants across restarts', () => {
    const { supervisor, latest } = supervised();
    latest().send({ type: 'snapshot', ...snapshot });
    supervisor.granted('C:/gigs/tour.lcshow');
    latest().exit();

    latest().exit();

    expect(latest().posted).toEqual([
      { type: 'grantPath', path: 'C:/gigs/tour.lcshow' },
      { type: 'restore', snapshot },
    ]);
  });

  it('ignores messages and exits from an engine that was replaced', () => {
    const { engines, latest } = supervised();
    const first = latest();
    first.exit();

    first.send({ type: 'snapshot', ...snapshot });
    first.exit();

    expect(engines).toHaveLength(2);
    latest().exit();
    expect(latest().posted).toEqual([]);
  });

  it('keeps the last good snapshot when the engine crashes again while restoring', () => {
    const { latest } = supervised();
    latest().send({ type: 'snapshot', ...snapshot });
    latest().exit();
    const reopened = { ...snapshot.show, unsaved: false };

    latest().send({ type: 'snapshot', ...snapshot, show: reopened });
    latest().exit();

    expect(latest().posted).toEqual([{ type: 'restore', snapshot }]);
  });

  it('takes snapshots again once the restore is done', () => {
    const { latest } = supervised();
    latest().send({ type: 'snapshot', ...snapshot });
    latest().exit();
    const saved = { ...snapshot.show, unsaved: false };

    latest().send({ type: 'restored', result: 'restored' });
    latest().send({ type: 'snapshot', show: saved });
    latest().exit();

    expect(latest().posted).toEqual([{ type: 'restore', snapshot: { ...snapshot, show: saved } }]);
  });

  it('stays down on the 4th exit within 60 s', () => {
    const { supervisor, engines, clock, downs, log, latest } = supervised();
    for (const at of [0, 10_000, 20_000]) {
      clock.now = at;
      latest().exit();
    }
    expect(engines).toHaveLength(4);

    clock.now = 59_000;
    latest().exit();

    expect(engines).toHaveLength(4);
    expect(downs()).toBe(1);
    expect(supervisor.isDown()).toBe(true);
    expect(log).toContain('The engine exited 4 times within a minute; not restarting it');
  });

  it('restarts again once earlier restarts are over a minute old', () => {
    const { engines, clock, downs, latest } = supervised();
    for (const at of [0, 10_000, 20_000]) {
      clock.now = at;
      latest().exit();
    }

    clock.now = 60_000;
    latest().exit();

    expect(engines).toHaveLength(5);
    expect(downs()).toBe(0);
  });
});
