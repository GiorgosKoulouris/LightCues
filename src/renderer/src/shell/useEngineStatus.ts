import { useEffect, useState } from 'react';

export type EngineStatus =
  | { state: 'waiting' }
  | { state: 'running'; roundTripMs: number; uptimeMs: number }
  // A ping went a whole heartbeat without a reply.
  | { state: 'notResponding' };

export const HEARTBEAT_MS = 2000;

// Whether the engine is answering: pings it on every heartbeat.
export function useEngineStatus(): EngineStatus {
  const [status, setStatus] = useState<EngineStatus>({ state: 'waiting' });

  useEffect(() => {
    // Send time by ping id, for pings not yet answered.
    const pending = new Map<number, number>();
    let nextId = 1;
    const ping = () => {
      const id = nextId++;
      pending.set(id, performance.now());
      window.engine.send({ type: 'ping', id });
    };

    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type !== 'pong') return;
      const sentAt = pending.get(event.id);
      if (sentAt === undefined) return;
      pending.clear();
      const roundTripMs = Math.round(performance.now() - sentAt);
      setStatus({ state: 'running', roundTripMs, uptimeMs: event.uptimeMs });
    });
    ping();
    const timer = setInterval(() => {
      if (pending.size > 0) setStatus({ state: 'notResponding' });
      ping();
    }, HEARTBEAT_MS);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, []);

  return status;
}
