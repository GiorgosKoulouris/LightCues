import { describe, expect, it } from 'vitest';
import type { EngineConnect } from '../shared/protocol';
import type { ParentPortLike, PortLike } from './serve';
import { serve } from './serve';

type Listener = (e: { data: unknown; ports?: PortLike[] }) => void;

const connect: EngineConnect = { type: 'connect' };

function fakePort() {
  const listeners: Listener[] = [];
  const sent: unknown[] = [];
  let started = false;
  let closed = false;
  const port = {
    on(_event: 'message', listener: Listener) {
      listeners.push(listener);
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
  };
}

describe('serve', () => {
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
});
