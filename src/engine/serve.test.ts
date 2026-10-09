import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  EngineConnect,
  EngineGrantPath,
  EngineRestore,
  EngineSnapshot,
} from '../shared/protocol';
import type { ParentPortLike, PortLike } from './serve';
import { serve } from './serve';

type Listener = (e: { data: unknown; ports?: PortLike[] }) => void;

const connect: EngineConnect = { type: 'connect' };

// What the engine sent the parent, apart from its snapshots.
const acks = (sent: unknown[]) => sent.filter((m) => (m as { type?: unknown }).type !== 'snapshot');

function fakePort() {
  const listeners: Listener[] = [];
  const closeListeners: (() => void)[] = [];
  const sent: unknown[] = [];
  let started = false;
  let closed = false;
  const port = {
    on(event: 'message' | 'close', listener: Listener) {
      if (event === 'close') closeListeners.push(listener as () => void);
      else listeners.push(listener);
    },
    postMessage(message: unknown) {
      sent.push(message);
    },
    start() {
      started = true;
    },
    close() {
      closed = true;
    },
  };
  return {
    port,
    sent,
    isStarted: () => started,
    isClosed: () => closed,
    deliver: (data: unknown, ports: PortLike[] = []) =>
      listeners.forEach((l) => l({ data, ports })),
    // The other end closes, e.g. the window is gone.
    closeRemote: () => closeListeners.forEach((l) => l()),
  };
}

// An engine on the Virtual Output, with no ports to scan.
const virtualOnly = { now: () => 0, serialPorts: { list: async () => [], open: vi.fn() } };

type FakePort = ReturnType<typeof fakePort>;

// Monitors Universe 1 before it is mapped, then lets `next` return the UI
// port to carry on with, maps Universe 1 to the Virtual Output there and
// returns the frames that port got.
async function framesAfter(next: (ui: FakePort, parent: FakePort) => FakePort) {
  const parent = fakePort();
  const first = fakePort();
  serve(parent.port as ParentPortLike, virtualOnly);
  parent.deliver(connect, [first.port]);
  first.deliver({ type: 'monitorUniverse', universe: 1 });
  const ui = next(first, parent);
  ui.deliver({
    type: 'editVenue',
    requestId: 1,
    edit: { type: 'putUniverse', universe: { number: 1, output: 'virtual' } },
  });
  await vi.advanceTimersByTimeAsync(500);
  return ui.sent.filter((m) => (m as { type?: unknown }).type === 'dmxFrame');
}

describe('serve', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('sends the monitored Universe once it is sent', async () => {
    vi.useFakeTimers();
    expect(await framesAfter((ui) => ui)).toHaveLength(1);
  });

  it('stops the channel monitor when the UI port closes', async () => {
    vi.useFakeTimers();
    const frames = await framesAfter((ui) => {
      ui.closeRemote();
      return ui;
    });
    expect(frames).toEqual([]);
  });

  it('stops the channel monitor when a newer UI port replaces the last one', async () => {
    vi.useFakeTimers();
    const frames = await framesAfter((_ui, parent) => {
      const newUi = fakePort();
      parent.deliver(connect, [newUi.port]);
      return newUi;
    });
    expect(frames).toEqual([]);
  });

  it('answers commands arriving on a UI port handed over by the parent', () => {
    const parent = fakePort();
    const ui = fakePort();
    serve(parent.port as ParentPortLike, { now: () => 0 });

    parent.deliver(connect, [ui.port]);
    ui.deliver({ type: 'ping', id: 1 });

    expect(ui.isStarted()).toBe(true);
    expect(ui.sent).toEqual([{ type: 'pong', id: 1, uptimeMs: 0 }]);
  });

  it('closes the previous UI port and replies only on the newest one', () => {
    const parent = fakePort();
    const oldUi = fakePort();
    const newUi = fakePort();
    serve(parent.port as ParentPortLike, { now: () => 0 });

    parent.deliver(connect, [oldUi.port]);
    parent.deliver(connect, [newUi.port]);
    newUi.deliver({ type: 'ping', id: 2 });

    expect(oldUi.isClosed()).toBe(true);
    expect(oldUi.sent).toEqual([]);
    expect(newUi.sent).toEqual([{ type: 'pong', id: 2, uptimeMs: 0 }]);
  });

  it('ignores parent messages that are not a connect', () => {
    const parent = fakePort();
    const ui = fakePort();
    serve(parent.port as ParentPortLike, { now: () => 0 });

    parent.deliver({ type: 'something-else' }, [ui.port]);

    expect(ui.isStarted()).toBe(false);
  });

  it('grants a path from the parent, acks it on the parent port, then uses it', () => {
    const parent = fakePort();
    const ui = fakePort();
    const files = new Map<string, string>();
    serve(parent.port as ParentPortLike, {
      now: () => 0,
      venueFiles: { read: () => '', write: (path, json) => void files.set(path, json) },
    });
    parent.deliver(connect, [ui.port]);
    const grant: EngineGrantPath = { type: 'grantPath', path: 'C:/gigs/club.lcvenue' };

    ui.deliver({ type: 'saveVenue', requestId: 1, path: 'C:/gigs/club.lcvenue' });
    parent.deliver(grant);
    ui.deliver({ type: 'saveVenue', requestId: 2, path: 'C:/gigs/club.lcvenue' });

    expect(acks(parent.sent)).toEqual([{ type: 'pathGranted', path: 'C:/gigs/club.lcvenue' }]);
    expect(ui.sent).toContainEqual({
      type: 'venueDone',
      requestId: 1,
      errors: ['Could not save C:/gigs/club.lcvenue: the file was not chosen in a file dialog'],
    });
    expect(ui.sent).toContainEqual({ type: 'venueDone', requestId: 2, errors: [] });
    expect([...files.keys()]).toEqual(['C:/gigs/club.lcvenue']);
  });

  it('ignores a grant without a string path', () => {
    const parent = fakePort();
    serve(parent.port as ParentPortLike, { now: () => 0 });

    parent.deliver({ type: 'grantPath', path: 7 });

    expect(acks(parent.sent)).toEqual([]);
  });

  it('drops UI messages that are not a command and answers the next one', () => {
    const parent = fakePort();
    const ui = fakePort();
    serve(parent.port as ParentPortLike, { now: () => 0 });
    parent.deliver(connect, [ui.port]);

    for (const data of [undefined, null, 'ping', 7, [], { id: 1 }, { type: 7 }]) {
      expect(() => ui.deliver(data)).not.toThrow();
    }
    ui.deliver({ type: 'ping', id: 3 });

    expect(ui.sent).toEqual([{ type: 'pong', id: 3, uptimeMs: 0 }]);
  });

  it('logs a command that throws and answers the next one', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const parent = fakePort();
    const ui = fakePort();
    let throwing = false;
    serve(parent.port as ParentPortLike, {
      now: () => {
        if (throwing) throw new Error('boom');
        return 0;
      },
    });
    parent.deliver(connect, [ui.port]);
    throwing = true;

    expect(() => ui.deliver({ type: 'ping', id: 4 })).not.toThrow();
    throwing = false;
    ui.deliver({ type: 'ping', id: 5 });

    expect(error).toHaveBeenCalledWith('Engine command ping failed.', expect.any(Error));
    expect(ui.sent).toEqual([{ type: 'pong', id: 5, uptimeMs: 0 }]);
  });

  it('sends the whole snapshot on start, then each part that changes', () => {
    const parent = fakePort();
    const ui = fakePort();
    serve(parent.port as ParentPortLike, { now: () => 0 });
    parent.deliver(connect, [ui.port]);

    ui.deliver({
      type: 'editShow',
      requestId: 1,
      edit: { type: 'putLayer', layer: { id: 'layer-2', name: 'Accents' } },
    });

    expect(parent.sent[0]).toMatchObject({
      type: 'snapshot',
      show: { unsaved: false },
      venue: { unsaved: false },
      playback: { grandMaster: 1 },
      midiInput: {},
    });
    expect(parent.sent.slice(1)).toEqual([
      { type: 'snapshot', show: expect.objectContaining({ unsaved: true }) },
    ]);
  });

  it('restores a snapshot from the parent and replies with the result', () => {
    const before = fakePort();
    serve(before.port as ParentPortLike, { now: () => 0 });
    const { show, venue, playback, midiInput } = before.sent[0] as EngineSnapshot;
    const restore: EngineRestore = {
      type: 'restore',
      snapshot: { show, venue, midiInput, playback: { ...playback, grandMaster: 0.3 } },
    };
    const after = fakePort();
    serve(after.port as ParentPortLike, { now: () => 0 });

    after.deliver(restore);

    // The reply, then the whole restored snapshot.
    expect(after.sent.slice(-2)).toEqual([
      { type: 'restored', result: 'restored' },
      expect.objectContaining({
        type: 'snapshot',
        show,
        playback: expect.objectContaining({ grandMaster: 0.3 }),
      }),
    ]);
  });

  it('ignores a restore without a snapshot', () => {
    const parent = fakePort();
    serve(parent.port as ParentPortLike, { now: () => 0 });

    parent.deliver({ type: 'restore' });

    expect(acks(parent.sent)).toEqual([]);
  });
});
