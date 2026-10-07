import type { EngineEvent } from '../../shared/protocol';

export type Reply = Extract<EngineEvent, { requestId: number }>;

// Shared by the whole renderer, so replies to different views never cross.
let nextRequestId = 1;

// Sends a command with a fresh request id and resolves to the engine's reply.
export function request(send: (requestId: number) => void): Promise<Reply> {
  const requestId = nextRequestId++;
  return new Promise((resolve) => {
    const unsubscribe = window.engine.onEvent((event) => {
      if (!('requestId' in event) || event.requestId !== requestId) return;
      unsubscribe();
      resolve(event);
    });
    send(requestId);
  });
}
