import type {
  EngineGrantPath,
  EngineRestore,
  EngineRestored,
  EngineSnapshot,
  RestoreResult,
} from '../shared/protocol';
import { createSnapshotStore, isSnapshotMessage } from './engine-snapshot';

// Restarts allowed within RESTART_WINDOW_MS. One more exit in the window and
// the engine stays down.
const MAX_RESTARTS = 3;
const RESTART_WINDOW_MS = 60_000;

// The parts of Electron's UtilityProcess the supervisor uses, so it is
// testable without Electron.
export interface EngineProcess {
  on(event: 'message', listener: (message: unknown) => void): void;
  on(event: 'exit', listener: (code: number) => void): void;
  postMessage(message: unknown): void;
}

export interface SupervisorOptions<P extends EngineProcess> {
  // Forks a new engine.
  start: () => P;
  // Milliseconds.
  now: () => number;
  log: (message: string) => void;
  // Gives the window a new port to `engine`, after a restart.
  connect: (engine: P) => void;
  // A restarted engine replied to its restore.
  restarted: (result: RestoreResult) => void;
  // The engine exited too often and is not restarted.
  down: () => void;
}

// Keeps an engine running (ADR 0011). Main tells it the paths it granted and
// when the app is quitting; it keeps the engine's latest snapshot. An exit
// while not quitting is a crash: a new engine starts at once, gets every
// path granted so far, then the snapshot, then the window's new port. After
// MAX_RESTARTS restarts within RESTART_WINDOW_MS, the next crash leaves the
// engine down.
export function superviseEngine<P extends EngineProcess>({
  start,
  now,
  log,
  connect,
  restarted,
  down,
}: SupervisorOptions<P>) {
  const snapshots = createSnapshotStore();
  const grants = new Set<string>();
  // When each restart in the window happened.
  let restarts: number[] = [];
  let quitting = false;
  let stopped = false;
  // While a restarted engine restores, its snapshots are ignored: its start
  // snapshot holds the files on disk, not the documents being restored. A
  // crash during the restore must leave the last good snapshot in place.
  let restoring = false;
  let engine = run();

  function run(): P {
    const started = start();
    started.on('message', (message) => {
      if (started !== engine) return;
      if (isSnapshotMessage(message)) {
        if (!restoring) snapshots.merge(message);
      } else if (isRestored(message)) {
        restoring = false;
        log(`Engine restore result: ${message.result}`);
        restarted(message.result);
      }
    });
    started.on('exit', () => {
      if (started === engine) exited();
    });
    return started;
  }

  function exited(): void {
    if (quitting) return;
    const time = now();
    restarts = restarts.filter((at) => time - at < RESTART_WINDOW_MS);
    if (restarts.length >= MAX_RESTARTS) {
      stopped = true;
      log(`The engine exited ${MAX_RESTARTS + 1} times within a minute; not restarting it`);
      down();
      return;
    }
    restarts.push(time);
    log('Restarting the engine');
    const snapshot = snapshots.latest();
    restoring = snapshot !== undefined;
    engine = run();
    for (const path of grants) {
      const grant: EngineGrantPath = { type: 'grantPath', path };
      engine.postMessage(grant);
    }
    if (snapshot) {
      const restore: EngineRestore = { type: 'restore', snapshot };
      engine.postMessage(restore);
    } else {
      log('No snapshot to restore');
      restarted('empty');
    }
    connect(engine);
  }

  return {
    // The running engine, or the last one when it is down.
    current: () => engine,
    // Whether the engine stopped for good.
    isDown: () => stopped,
    // A grant the engine acked, re-sent to each new engine.
    granted: (path: string) => void grants.add(path),
    // Exits from now on are expected.
    quitting: () => void (quitting = true),
    snapshot: (): EngineSnapshot | undefined => snapshots.latest(),
  };
}

function isRestored(message: unknown): message is EngineRestored {
  return (message as EngineRestored | undefined)?.type === 'restored';
}
