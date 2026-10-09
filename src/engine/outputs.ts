import type { EngineEvent, OutputStatus } from '../shared/protocol';
import { DMX_CHANNELS, VIRTUAL_OUTPUT, type Universe } from '../shared/venue-patch';
import { encodeSendDmx } from './enttec';

// ~40 Hz, under the 44 Hz a full 512-channel DMX universe allows.
const FRAME_INTERVAL_MS = 25;
// How often serial ports are listed to find plugged and unplugged devices.
const SCAN_INTERVAL_MS = 1000;
// A write pending this long (one second of frames) counts as failed.
const MAX_WAITED_FRAMES = 1000 / FRAME_INTERVAL_MS;

// FTDI's USB vendor id. Enttec DMX USB Pro and DMXking ultraDMX devices are
// built on FTDI chips.
const FTDI_VENDOR_ID = '0403';

const BLACKOUT = new Uint8Array(DMX_CHANNELS);

// What listing serial ports tells about one of them.
export interface SerialPortInfo {
  path: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
  manufacturer?: string;
}

interface SerialConnection {
  // `done` is called once the data is written, with an error if it failed.
  write(data: Uint8Array, done: (error?: Error) => void): void;
  close(): void;
}

// The machine's serial ports. Structural, so the engine is testable without
// hardware.
export interface SerialPorts {
  list(): Promise<SerialPortInfo[]>;
  // `onLost` is called if the port closes without being asked to, e.g. when
  // the device is unplugged.
  open(path: string, onLost: () => void): Promise<SerialConnection>;
}

interface OutputsOptions {
  ports: SerialPorts;
  emit: (event: EngineEvent) => void;
  // The current Venue Patch's Universes.
  universes: () => Universe[];
  // The DMX channels to send per Universe, channel 1 first. Called once per
  // send tick; a Universe without a frame gets a blackout.
  frames: () => Map<number, Uint8Array>;
}

interface DiscoveredOutput {
  path: string;
  name: string;
}

// The link to an Output a Universe is mapped to. `waited` counts the frames
// skipped while a write is pending.
type Link =
  | { state: 'connecting' }
  | { state: 'sending'; port: SerialConnection; writing: boolean; waited: number }
  | { state: 'failed'; error: string };

// Finds Outputs, keeps a port open to each one a Universe is mapped to, and
// sends every mapped Universe's frame to its Output at ~40 Hz. An Output that
// is unplugged, or fails, is reopened when a scan finds it again. The Virtual
// Output has no port: it keeps the last frame of each Universe mapped to it.
// The last frame sent for each Universe, to any Output, is kept for the
// channel monitor and tests.
export function createOutputs({ ports, emit, universes, frames }: OutputsOptions) {
  let discovered = new Map<string, DiscoveredOutput>();
  const links = new Map<string, Link>();
  const sentFrames = new Map<number, Uint8Array>();
  let scanning = false;
  let lastEmitted = '';

  // The real Outputs a Universe is mapped to.
  function mappedPorts(): Set<string> {
    return new Set(
      universes().flatMap((u) =>
        u.output === undefined || u.output === VIRTUAL_OUTPUT ? [] : [u.output],
      ),
    );
  }

  function virtualUniverses(): Set<number> {
    return new Set(universes().flatMap((u) => (u.output === VIRTUAL_OUTPUT ? [u.number] : [])));
  }

  function statuses(): OutputStatus[] {
    const ids = new Set([...discovered.keys(), ...mappedPorts()]);
    const virtual: OutputStatus = {
      id: VIRTUAL_OUTPUT,
      name: 'Virtual Output',
      state: virtualUniverses().size > 0 ? 'sending' : 'unused',
    };
    return [
      ...[...ids].sort().map((id): OutputStatus => {
        const name = discovered.get(id)?.name ?? id;
        const link = links.get(id);
        if (!discovered.has(id)) return { id, name, state: 'missing' };
        if (!link) return { id, name, state: 'unused' };
        if (link.state === 'failed') return { id, name, state: 'failed', error: link.error };
        return { id, name, state: link.state };
      }),
      virtual,
    ];
  }

  function emitChanges(): void {
    const outputs = statuses();
    const json = JSON.stringify(outputs);
    if (json === lastEmitted) return;
    lastEmitted = json;
    emit({ type: 'outputs', outputs });
  }

  function disconnect(id: string): void {
    const link = links.get(id);
    if (link?.state === 'sending') link.port.close();
    links.delete(id);
  }

  // Closes the Output's port; the next scan reopens it.
  function fail(id: string, error: string): void {
    disconnect(id);
    links.set(id, { state: 'failed', error });
    emitChanges();
  }

  // Closes Outputs that are gone or no longer mapped, and opens mapped ones.
  // Failed Outputs are retried only when `retry` is set. Drops the frames of
  // Universes no longer mapped.
  function reconcile({ retry }: { retry: boolean }): void {
    const mapped = new Set(universes().flatMap((u) => (u.output === undefined ? [] : [u.number])));
    for (const number of [...sentFrames.keys()]) {
      if (!mapped.has(number)) sentFrames.delete(number);
    }
    const wanted = mappedPorts();
    for (const id of [...links.keys()]) {
      if (!discovered.has(id) || !wanted.has(id)) disconnect(id);
    }
    for (const id of wanted) {
      const output = discovered.get(id);
      const link = links.get(id);
      if (output && (!link || (retry && link.state === 'failed'))) connect(id, output.path);
    }
    emitChanges();
  }

  function connect(id: string, path: string): void {
    const connecting: Link = { state: 'connecting' };
    let sending: Link | undefined;
    links.set(id, connecting);
    ports
      .open(path, () => {
        if (links.get(id) === sending) fail(id, 'Disconnected');
      })
      .then(
        (port) => {
          // Unmapped or unplugged while opening.
          if (links.get(id) !== connecting) return port.close();
          sending = { state: 'sending', port, writing: false, waited: 0 };
          links.set(id, sending);
          emitChanges();
        },
        (error: Error) => {
          if (links.get(id) === connecting) fail(id, error.message);
        },
      );
  }

  async function scan(): Promise<void> {
    if (scanning) return;
    scanning = true;
    try {
      const listed = await ports.list();
      discovered = new Map(
        listed.filter(isOutputPort).map((port) => [outputId(port), discoveredOutput(port)]),
      );
    } catch (error) {
      console.error('Could not list serial ports.', error);
    } finally {
      scanning = false;
    }
    reconcile({ retry: true });
  }

  function sendFrames(): void {
    const tick = frames();
    for (const { number, output } of universes()) {
      if (output === undefined) continue;
      const frame = tick.get(number) ?? BLACKOUT;
      if (output === VIRTUAL_OUTPUT) {
        sentFrames.set(number, frame.slice());
        continue;
      }
      const link = links.get(output);
      if (link?.state !== 'sending') {
        sentFrames.delete(number);
        continue;
      }
      if (link.writing) {
        if (++link.waited >= MAX_WAITED_FRAMES) fail(output, 'Write did not complete');
        continue;
      }
      link.writing = true;
      link.waited = 0;
      sentFrames.set(number, frame.slice());
      link.port.write(encodeSendDmx(frame), (error) => {
        link.writing = false;
        if (error && links.get(output) === link) fail(output, error.message);
      });
    }
  }

  void scan();
  setInterval(() => void scan(), SCAN_INTERVAL_MS);
  setInterval(sendFrames, FRAME_INTERVAL_MS);

  return {
    // Call when the Venue Patch's Universes may have changed.
    patchChanged: () => reconcile({ retry: false }),
    emitOutputs(): void {
      const outputs = statuses();
      lastEmitted = JSON.stringify(outputs);
      emit({ type: 'outputs', outputs });
    },
    // The last frame the Virtual Output got for the Universe, if it is
    // mapped there.
    lastFrame: (universe: number): Uint8Array | undefined =>
      virtualUniverses().has(universe) ? sentFrames.get(universe) : undefined,
    // The frame last sent for the Universe, to a real or the Virtual Output,
    // while it is sent.
    sentFrame: (universe: number): Uint8Array | undefined => sentFrames.get(universe),
  };
}

function isOutputPort(port: SerialPortInfo): boolean {
  return port.vendorId?.toLowerCase() === FTDI_VENDOR_ID;
}

// The USB serial number stays the same when Windows gives the device another
// COM port; the port is a fallback for devices without one.
function outputId(port: SerialPortInfo): string {
  return port.serialNumber || port.path;
}

function discoveredOutput(port: SerialPortInfo): DiscoveredOutput {
  const name = port.serialNumber ? `${port.serialNumber} on ${port.path}` : port.path;
  return { path: port.path, name };
}
