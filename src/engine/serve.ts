import type {
  EngineCommand,
  EngineConnect,
  EngineGrantPath,
  EnginePathGranted,
  EngineRestore,
  EngineRestored,
  EngineSnapshot,
  EngineSnapshotMessage,
  RestoreResult,
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

function isRestore(data: unknown): data is EngineRestore {
  const restore = data as EngineRestore | undefined;
  return restore?.type === 'restore' && typeof restore.snapshot === 'object';
}

// Runs the engine behind a parent port. The parent hands over a UI port with
// each `connect` message; a newer UI port (e.g. after a window reload)
// replaces and closes the previous one. The parent also grants the paths the
// user picked, and each grant is acked on the parent port. The engine sends
// its snapshot to the parent, whole on start and then as it changes, and
// restores one the parent sends after a restart (ADR 0011). A command that
// throws is logged; it must not end the engine, or DMX output stops.
export function serve(
  parentPort: ParentPortLike,
  options: Omit<EngineOptions, 'emit' | 'report'> = {},
): void {
  let uiPort: PortLike | undefined;
  const sendSnapshot = (part: Partial<EngineSnapshot>) => {
    const message: EngineSnapshotMessage = { type: 'snapshot', ...part };
    parentPort.postMessage(message);
  };
  const engine = createEngine({
    ...options,
    emit: (event) => uiPort?.postMessage(event),
    report: sendSnapshot,
  });
  sendSnapshot(engine.snapshot());

  // A restore that throws even on its last fallback must not end the engine
  // either.
  function restore(snapshot: EngineSnapshot): RestoreResult {
    try {
      return engine.restore(snapshot);
    } catch (error) {
      console.error('Engine restore failed.', error);
      return 'empty';
    }
  }

  parentPort.on('message', ({ data, ports }) => {
    if (isRestore(data)) {
      const restored: EngineRestored = { type: 'restored', result: restore(data.snapshot) };
      parentPort.postMessage(restored);
      // Whole again, since the parent ignores parts sent while restoring.
      sendSnapshot(engine.snapshot());
      return;
    }
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
