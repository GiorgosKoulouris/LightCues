import type { EngineCommand, EngineConnect } from '../shared/protocol';
import { createEngine, type EngineOptions } from './engine';

// Structural stand-ins for Electron's MessagePortMain and utilityProcess
// parentPort, so the engine never imports Electron.
export interface PortLike {
  on(event: 'message', listener: (e: { data: unknown }) => void): void;
  postMessage(message: unknown): void;
  start(): void;
  close(): void;
}

export interface ParentPortLike {
  on(event: 'message', listener: (e: { data: unknown; ports: PortLike[] }) => void): void;
}

function isConnect(data: unknown): data is EngineConnect {
  return (data as EngineConnect | undefined)?.type === 'connect';
}

// Runs the engine behind a parent port. The parent hands over a UI port with
// each `connect` message; a newer UI port (e.g. after a window reload)
// replaces and closes the previous one.
export function serve(
  parentPort: ParentPortLike,
  options: Pick<EngineOptions, 'now' | 'storage' | 'venueFiles' | 'showFiles' | 'serialPorts'> = {},
): void {
  let uiPort: PortLike | undefined;
  const engine = createEngine({ ...options, emit: (event) => uiPort?.postMessage(event) });

  parentPort.on('message', ({ data, ports }) => {
    const port = ports[0];
    if (!isConnect(data) || !port) return;
    uiPort?.close();
    uiPort = port;
    port.on('message', ({ data }) => engine.handle(data as EngineCommand));
    port.start();
  });
}
