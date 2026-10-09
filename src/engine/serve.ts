import type {
  EngineCommand,
  EngineConnect,
  EngineGrantPath,
  EnginePathGranted,
} from '../shared/protocol';
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
  postMessage(message: unknown): void;
}

function isConnect(data: unknown): data is EngineConnect {
  return (data as EngineConnect | undefined)?.type === 'connect';
}

// Anything else from the UI port is dropped before it reaches the engine.
function isCommand(data: unknown): data is EngineCommand {
  return typeof (data as { type?: unknown } | undefined)?.type === 'string';
}

function isGrantPath(data: unknown): data is EngineGrantPath {
  const grant = data as EngineGrantPath | undefined;
  return grant?.type === 'grantPath' && typeof grant.path === 'string';
}

// Runs the engine behind a parent port. The parent hands over a UI port with
// each `connect` message; a newer UI port (e.g. after a window reload)
// replaces and closes the previous one. The parent also grants the paths the
// user picked, and each grant is acked on the parent port. A command that
// throws is logged; it must not end the engine, or DMX output stops.
export function serve(parentPort: ParentPortLike, options: Omit<EngineOptions, 'emit'> = {}): void {
  let uiPort: PortLike | undefined;
  const engine = createEngine({ ...options, emit: (event) => uiPort?.postMessage(event) });

  parentPort.on('message', ({ data, ports }) => {
    if (isGrantPath(data)) {
      engine.grantPath(data.path);
      const granted: EnginePathGranted = { type: 'pathGranted', path: data.path };
      parentPort.postMessage(granted);
      return;
    }
    const port = ports[0];
    if (!isConnect(data) || !port) return;
    uiPort?.close();
    uiPort = port;
    port.on('message', ({ data }) => {
      if (!isCommand(data)) return;
      try {
        engine.handle(data);
      } catch (error) {
        console.error(`Engine command ${data.type} failed.`, error);
      }
    });
    port.start();
  });
}
