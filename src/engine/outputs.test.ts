import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FixtureProfile } from '../shared/fixture-profile';
import type { EngineCommand, EngineEvent, OutputStatus, ShowEdit } from '../shared/protocol';
import type { Scene } from '../shared/show';
import type { PatchedFixture, Universe } from '../shared/venue-patch';
import { createEngine } from './engine';
import { encodeSendDmx } from './enttec';
import type { SerialPortInfo, SerialPorts } from './outputs';

const FTDI = { vendorId: '0403', productId: '6001', manufacturer: 'FTDI' };
const blackout = encodeSendDmx(new Uint8Array(512));

interface FakePort {
  writes: Uint8Array[];
  closed: boolean;
  lose(): void;
}

// Stands in for the serial ports of the machine. Devices are plugged in by
// port path; `opened` holds every port the engine opened, latest last.
function fakeSerial() {
  const devices = new Map<string, SerialPortInfo>();
  const opened: (FakePort & { path: string })[] = [];
  const failing = new Set<string>();
  let writesPending = false;
  let writeError: Error | undefined;
  const pending: (() => void)[] = [];

  const ports: SerialPorts = {
    list: async () => [...devices.values()],
    async open(path, onLost) {
      if (failing.has(path)) throw new Error('Access denied');
      const port = { path, writes: [] as Uint8Array[], closed: false, lose: () => onLost() };
      opened.push(port);
      return {
        write(data, done) {
          port.writes.push(data);
          if (writeError) done(writeError);
          else if (writesPending) pending.push(() => done());
          else done();
        },
        close: () => void (port.closed = true),
      };
    },
  };

  return {
    ports,
    opened,
    // The latest port opened at `path`.
    port: (path: string) => opened.findLast((p) => p.path === path),
    plug(path: string, serialNumber?: string, info: Partial<SerialPortInfo> = FTDI) {
      devices.set(path, { path, serialNumber, ...info });
    },
    // Pulls the device out: its open port is lost.
    unplug(path: string) {
      devices.delete(path);
      const port = opened.findLast((p) => p.path === path && !p.closed);
      if (port) port.lose();
    },
    failOpening: (path: string, fail = true) => (fail ? failing.add(path) : failing.delete(path)),
    failWrites: (error?: Error) => void (writeError = error),
    // While held, writes do not complete.
    holdWrites(hold: boolean) {
      writesPending = hold;
      if (!hold) pending.splice(0).forEach((done) => done());
    },
  };
}

function outputsEngine() {
  const serial = fakeSerial();
  const events: EngineEvent[] = [];
  const engine = createEngine({ emit: (e) => events.push(e), serialPorts: serial.ports });
  let requestId = 1;
  return {
    serial,
    events,
    mapUniverse(universe: Universe) {
      engine.handle({
        type: 'editVenue',
        requestId: requestId++,
        edit: { type: 'putUniverse', universe },
      });
    },
    removeUniverse(number: number) {
      engine.handle({
        type: 'editVenue',
        requestId: requestId++,
        edit: { type: 'removeUniverse', number },
      });
    },
    // The latest Outputs the engine reported.
    outputs(): OutputStatus[] | undefined {
      const event = events.findLast((e) => e.type === 'outputs');
      return event?.type === 'outputs' ? event.outputs : undefined;
    },
    listOutputs: () => engine.handle({ type: 'listOutputs' }),
  };
}

describe('engine Outputs', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('discovers FTDI USB serial ports as Outputs, by serial number', async () => {
    const { serial, outputs, listOutputs } = outputsEngine();
    serial.plug('COM3', 'EN123456');
    serial.plug('COM4');
    serial.plug('COM5', 'BT1', { vendorId: '8087', productId: '0aaa' });

    await vi.advanceTimersByTimeAsync(1000);

    const expected = [
      { id: 'COM4', name: 'COM4', state: 'unused' },
      { id: 'EN123456', name: 'EN123456 on COM3', state: 'unused' },
    ];
    expect(outputs()).toEqual(expected);
    listOutputs();
    expect(outputs()).toEqual(expected);
  });

  it('sends a blackout frame about 40 times a second to an Output a Universe is mapped to', async () => {
    const { serial, mapUniverse, outputs } = outputsEngine();
    serial.plug('COM3', 'EN1');
    serial.plug('COM4', 'EN2');
    await vi.advanceTimersByTimeAsync(1000);

    mapUniverse({ number: 1, output: 'EN1' });
    await vi.advanceTimersByTimeAsync(1000);

    expect(serial.port('COM4')).toBeUndefined();
    const writes = serial.port('COM3')?.writes ?? [];
    expect(writes.length).toBeGreaterThanOrEqual(38);
    expect(writes.length).toBeLessThanOrEqual(41);
    expect(writes.every((w) => w.join() === blackout.join())).toBe(true);
    expect(outputs()).toEqual([
      { id: 'EN1', name: 'EN1 on COM3', state: 'sending' },
      { id: 'EN2', name: 'EN2 on COM4', state: 'unused' },
    ]);
  });

  it('sends to several Outputs at once', async () => {
    const { serial, mapUniverse } = outputsEngine();
    serial.plug('COM3', 'EN1');
    serial.plug('COM4', 'EN2');
    mapUniverse({ number: 1, output: 'EN1' });
    mapUniverse({ number: 2, output: 'EN2' });

    // The next scan finds them.
    await vi.advanceTimersByTimeAsync(2000);

    expect(serial.port('COM3')?.writes.length).toBeGreaterThan(30);
    expect(serial.port('COM4')?.writes.length).toBeGreaterThan(30);
  });

  it('reports a mapped Output that is not plugged in as missing', async () => {
    const { mapUniverse, outputs } = outputsEngine();
    mapUniverse({ number: 1, output: 'EN9' });

    await vi.advanceTimersByTimeAsync(1000);

    expect(outputs()).toEqual([{ id: 'EN9', name: 'EN9', state: 'missing' }]);
  });

  it('recovers when the device is unplugged and plugged back in', async () => {
    const { serial, mapUniverse, outputs } = outputsEngine();
    serial.plug('COM3', 'EN1');
    mapUniverse({ number: 1, output: 'EN1' });
    await vi.advanceTimersByTimeAsync(1000);

    serial.unplug('COM3');
    const before = serial.port('COM3')?.writes.length;
    await vi.advanceTimersByTimeAsync(2000);

    expect(serial.port('COM3')?.writes.length).toBe(before);
    expect(outputs()).toEqual([{ id: 'EN1', name: 'EN1', state: 'missing' }]);

    // Windows may give it a new COM port.
    serial.plug('COM7', 'EN1');
    await vi.advanceTimersByTimeAsync(2000);

    expect(serial.port('COM7')?.writes.length).toBeGreaterThan(30);
    expect(outputs()).toEqual([{ id: 'EN1', name: 'EN1 on COM7', state: 'sending' }]);
  });

  it('retries an Output that failed to open on the next scan', async () => {
    const { serial, mapUniverse, outputs } = outputsEngine();
    serial.plug('COM3', 'EN1');
    serial.failOpening('COM3');
    mapUniverse({ number: 1, output: 'EN1' });
    await vi.advanceTimersByTimeAsync(1000);

    expect(outputs()).toEqual([
      { id: 'EN1', name: 'EN1 on COM3', state: 'failed', error: 'Access denied' },
    ]);

    serial.failOpening('COM3', false);
    await vi.advanceTimersByTimeAsync(1000);

    expect(outputs()).toEqual([{ id: 'EN1', name: 'EN1 on COM3', state: 'sending' }]);
  });

  it('reopens an Output after a write fails', async () => {
    const { serial, mapUniverse, outputs } = outputsEngine();
    serial.plug('COM3', 'EN1');
    mapUniverse({ number: 1, output: 'EN1' });
    await vi.advanceTimersByTimeAsync(1000);

    serial.failWrites(new Error('Write timeout'));
    await vi.advanceTimersByTimeAsync(25);

    const failed = serial.port('COM3');
    expect(failed?.closed).toBe(true);
    expect(outputs()).toEqual([
      { id: 'EN1', name: 'EN1 on COM3', state: 'failed', error: 'Write timeout' },
    ]);

    serial.failWrites(undefined);
    await vi.advanceTimersByTimeAsync(1000);

    expect(serial.port('COM3')).not.toBe(failed);
    expect(serial.port('COM3')?.writes.length).toBeGreaterThan(0);
    expect(outputs()?.[0]?.state).toBe('sending');
  });

  it('closes the port when its Universe is unmapped or removed', async () => {
    const { serial, mapUniverse, removeUniverse, outputs } = outputsEngine();
    serial.plug('COM3', 'EN1');
    serial.plug('COM4', 'EN2');
    mapUniverse({ number: 1, output: 'EN1' });
    mapUniverse({ number: 2, output: 'EN2' });
    await vi.advanceTimersByTimeAsync(1000);

    mapUniverse({ number: 1 });
    removeUniverse(2);
    await vi.advanceTimersByTimeAsync(0);

    expect(serial.port('COM3')?.closed).toBe(true);
    expect(serial.port('COM4')?.closed).toBe(true);
    expect(outputs()?.map((o) => o.state)).toEqual(['unused', 'unused']);
  });

  it('skips frames while the previous write has not completed', async () => {
    const { serial, mapUniverse } = outputsEngine();
    serial.plug('COM3', 'EN1');
    mapUniverse({ number: 1, output: 'EN1' });
    await vi.advanceTimersByTimeAsync(1000);

    serial.holdWrites(true);
    const before = serial.port('COM3')?.writes.length ?? 0;
    await vi.advanceTimersByTimeAsync(500);

    expect(serial.port('COM3')?.writes.length).toBe(before + 1);
  });

  it('reopens an Output whose write has not completed for a second', async () => {
    const { serial, mapUniverse, outputs } = outputsEngine();
    serial.plug('COM3', 'EN1');
    mapUniverse({ number: 1, output: 'EN1' });
    await vi.advanceTimersByTimeAsync(1000);

    serial.holdWrites(true);
    await vi.advanceTimersByTimeAsync(1100);

    const stuck = serial.port('COM3');
    expect(stuck?.closed).toBe(true);
    expect(outputs()).toEqual([
      { id: 'EN1', name: 'EN1 on COM3', state: 'failed', error: 'Write did not complete' },
    ]);

    serial.holdWrites(false);
    await vi.advanceTimersByTimeAsync(1000);

    expect(serial.port('COM3')).not.toBe(stuck);
    expect(outputs()?.[0]?.state).toBe('sending');
  });
});

const dimmer: FixtureProfile = {
  id: 'acme/dimmer',
  manufacturer: 'Acme',
  model: 'Dimmer',
  defaultRole: 'Wash',
  modes: [
    {
      name: '1ch',
      channels: [
        {
          kind: 'control',
          name: 'Dimmer',
          defaultValue: 0,
          ranges: [{ from: 0, to: 255, capability: { type: 'intensity' } }],
        },
      ],
    },
  ],
};

const wash: Scene = {
  id: 'wash',
  name: 'Wash',
  tags: [],
  layer: 'layer-1',
  fadeIn: 2,
  rules: [{ target: {}, intensity: 1 }],
};

// An engine sending Universe 1, which holds one dimmer at address 1, to an
// Output on COM3. The Show holds `wash`.
async function playbackEngine() {
  const serial = fakeSerial();
  const events: EngineEvent[] = [];
  const engine = createEngine({
    emit: (e) => events.push(e),
    now: () => Date.now(),
    serialPorts: serial.ports,
  });
  let requestId = 1;
  engine.handle({ type: 'saveProfile', requestId: requestId++, profile: dimmer });
  const fixture: PatchedFixture = {
    ...{ id: 'f1', name: 'Dimmer 1', profileId: 'acme/dimmer', mode: '1ch' },
    ...{ universe: 1, address: 1, x: 0, y: 1, height: 0 },
  };
  for (const edit of [
    { type: 'putUniverse', universe: { number: 1, output: 'EN1' } },
    { type: 'putFixture', fixture },
  ] as const) {
    engine.handle({ type: 'editVenue', requestId: requestId++, edit });
  }
  const editShow = (edit: ShowEdit) =>
    engine.handle({ type: 'editShow', requestId: requestId++, edit });
  editShow({ type: 'putScene', scene: wash });
  serial.plug('COM3', 'EN1');
  await vi.advanceTimersByTimeAsync(1000);

  return {
    events,
    editShow,
    send: (command: EngineCommand) => engine.handle(command),
    // The dimmer's level in the latest frame sent.
    level: () => serial.port('COM3')?.writes.at(-1)?.[5],
    // The latest active Scenes and mode the engine reported.
    playback() {
      const event = events.findLast((e) => e.type === 'playback');
      return event?.type === 'playback' ? event : undefined;
    },
  };
}

describe('engine Scene playback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fades a Scene in on the Outputs when it is activated', async () => {
    const { send, level, playback } = await playbackEngine();
    expect(level()).toBe(0);

    send({ type: 'goScene', sceneId: 'wash' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(level()).toBeGreaterThan(115);
    expect(level()).toBeLessThan(140);
    await vi.advanceTimersByTimeAsync(1000);

    expect(level()).toBe(255);
    expect(playback()).toEqual({
      type: 'playback',
      active: { 'layer-1': 'wash' },
      mode: 'monitor',
    });
  });

  it('sends an edit to the active Scene live in Monitor', async () => {
    const { send, editShow, level } = await playbackEngine();
    send({ type: 'goScene', sceneId: 'wash' });
    await vi.advanceTimersByTimeAsync(2000);

    editShow({ type: 'putScene', scene: { ...wash, rules: [{ target: {}, intensity: 0.2 }] } });
    await vi.advanceTimersByTimeAsync(100);

    expect(level()).toBe(51);
  });

  it('holds the Outputs at their current frame in Blind, while Scenes and edits change', async () => {
    const { send, editShow, level, playback } = await playbackEngine();
    send({ type: 'goScene', sceneId: 'wash' });
    await vi.advanceTimersByTimeAsync(2000);

    send({ type: 'setMode', mode: 'blind' });
    editShow({ type: 'putScene', scene: { ...wash, rules: [{ target: {}, intensity: 0.2 }] } });
    await vi.advanceTimersByTimeAsync(500);
    expect(level()).toBe(255);
    send({ type: 'clearLayer', layerId: 'layer-1' });
    await vi.advanceTimersByTimeAsync(500);
    expect(level()).toBe(255);
    expect(playback()).toEqual({ type: 'playback', active: {}, mode: 'blind' });

    send({ type: 'setMode', mode: 'monitor' });
    await vi.advanceTimersByTimeAsync(100);
    expect(level()).toBe(0);
  });

  it('stops a Scene that is removed or moved to another Layer, and reports it', async () => {
    const { send, editShow, level, playback } = await playbackEngine();
    editShow({ type: 'putLayer', layer: { id: 'layer-2', name: 'Accents' } });
    send({ type: 'goScene', sceneId: 'wash' });
    await vi.advanceTimersByTimeAsync(2000);

    editShow({ type: 'putScene', scene: { ...wash, layer: 'layer-2' } });
    expect(playback()?.active).toEqual({});
    await vi.advanceTimersByTimeAsync(100);
    expect(level()).toBe(0);

    send({ type: 'goScene', sceneId: 'wash' });
    editShow({ type: 'removeLayer', id: 'layer-2' });
    expect(playback()?.active).toEqual({});
  });

  it('clears the active Scenes when another Show is started', async () => {
    const { send, playback } = await playbackEngine();
    send({ type: 'goScene', sceneId: 'wash' });

    send({ type: 'newShow' });

    expect(playback()?.active).toEqual({});
  });
});
