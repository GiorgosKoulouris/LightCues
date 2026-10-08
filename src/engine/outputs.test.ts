import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CapabilityRange, Channel, FixtureProfile } from '../shared/fixture-profile';
import type {
  EngineCommand,
  EngineEvent,
  OutputStatus,
  ShowEdit,
  VenueEdit,
} from '../shared/protocol';
import type { Scene } from '../shared/show';
import { DEFAULT_MOUNTING, type PatchedFixture, type Universe } from '../shared/venue-patch';
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
    writes: () => serial.port('COM3')?.writes ?? [],
    // The dimmer's level in the latest frame sent.
    level: () => serial.port('COM3')?.writes.at(-1)?.[5],
    // The dimmer's light in the latest preview the engine sent.
    light() {
      const event = events.findLast((e) => e.type === 'preview');
      return event?.type === 'preview' ? event.lights.f1 : undefined;
    },
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
      grandMaster: 1,
      blackout: false,
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
    expect(playback()).toMatchObject({ active: {}, mode: 'blind' });

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

describe('engine Fallback Panel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // `playbackEngine` has no MIDI input, so these also show the panel works
  // without one.
  async function litEngine() {
    const engine = await playbackEngine();
    engine.send({ type: 'startPreview' });
    engine.send({ type: 'goScene', sceneId: 'wash' });
    await vi.advanceTimersByTimeAsync(2000);
    return engine;
  }

  it('scales intensity on the Outputs and in the preview by the Grand Master', async () => {
    const { send, level, light, playback } = await litEngine();

    send({ type: 'setGrandMaster', level: 0.2 });
    await vi.advanceTimersByTimeAsync(100);

    expect(level()).toBe(51);
    expect(light()?.intensity).toBeCloseTo(0.2);
    expect(playback()).toMatchObject({ grandMaster: 0.2, blackout: false });

    send({ type: 'setGrandMaster', level: 1.5 });
    expect(playback()?.grandMaster).toBe(1);
    send({ type: 'setGrandMaster', level: -1 });
    expect(playback()?.grandMaster).toBe(0);
    send({ type: 'setGrandMaster', level: Number.NaN });
    expect(playback()?.grandMaster).toBe(0);
  });

  it('blacks out the Outputs and the preview until released, keeping the Scenes active', async () => {
    const { send, level, light, playback } = await litEngine();

    send({ type: 'setBlackout', on: true });
    await vi.advanceTimersByTimeAsync(100);

    expect(level()).toBe(0);
    expect(light()?.intensity).toBe(0);
    expect(playback()).toMatchObject({ active: { 'layer-1': 'wash' }, blackout: true });

    send({ type: 'setBlackout', on: false });
    await vi.advanceTimersByTimeAsync(100);

    expect(level()).toBe(255);
    expect(light()?.intensity).toBe(1);
  });

  it('shows the Grand Master in Blind only in the preview, holding the Outputs', async () => {
    const { send, level, light } = await litEngine();
    send({ type: 'setMode', mode: 'blind' });

    send({ type: 'setGrandMaster', level: 0.5 });
    await vi.advanceTimersByTimeAsync(100);

    expect(light()?.intensity).toBeCloseTo(0.5);
    expect(level()).toBe(255);
  });

  it('blacks out the Outputs in Blind too, then holds them at their frame again', async () => {
    const { send, level, light } = await litEngine();
    send({ type: 'setMode', mode: 'blind' });

    send({ type: 'setBlackout', on: true });
    await vi.advanceTimersByTimeAsync(100);
    expect(level()).toBe(0);
    expect(light()?.intensity).toBe(0);

    send({ type: 'clearLayer', layerId: 'layer-1' });
    send({ type: 'setBlackout', on: false });
    await vi.advanceTimersByTimeAsync(100);
    expect(level()).toBe(255);
  });

  it('goes to the Base Look, clearing the other Layers', async () => {
    const { send, editShow, level, playback } = await playbackEngine();
    editShow({ type: 'putLayer', layer: { id: 'layer-2', name: 'Accents' } });
    const base: Scene = { ...wash, id: 'base', fadeIn: 0, rules: [{ target: {}, intensity: 0.2 }] };
    editShow({ type: 'putScene', scene: { ...wash, layer: 'layer-2' } });
    editShow({ type: 'putScene', scene: base });
    send({ type: 'goScene', sceneId: 'wash' });
    send({ type: 'goBaseLook' });
    expect(playback()?.active).toEqual({ 'layer-2': 'wash' });

    editShow({ type: 'setBaseLook', sceneId: 'base' });
    send({ type: 'goBaseLook' });
    await vi.advanceTimersByTimeAsync(100);

    expect(playback()?.active).toEqual({ 'layer-1': 'base' });
    expect(level()).toBe(51);
  });
});

describe('engine preview', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const white = { red: 1, green: 1, blue: 1 };

  it("sends the Fixtures' lights once started, and again when they change", async () => {
    const { send, events, light } = await playbackEngine();
    expect(events.some((e) => e.type === 'preview')).toBe(false);

    send({ type: 'startPreview' });
    expect(light()).toEqual({ intensity: 0, ...white });
    await vi.advanceTimersByTimeAsync(500);
    expect(events.filter((e) => e.type === 'preview')).toHaveLength(1);

    send({ type: 'goScene', sceneId: 'wash' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(light()?.intensity).toBeCloseTo(0.5, 1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(light()).toEqual({ intensity: 1, ...white });

    send({ type: 'stopPreview' });
    const sent = events.length;
    send({ type: 'clearLayer', layerId: 'layer-1' });
    await vi.advanceTimersByTimeAsync(500);
    expect(events.slice(sent).some((e) => e.type === 'preview')).toBe(false);
  });

  it('keeps updating while Blind freezes the Outputs at their current frame', async () => {
    const { send, editShow, level, light } = await playbackEngine();
    send({ type: 'startPreview' });
    send({ type: 'goScene', sceneId: 'wash' });
    await vi.advanceTimersByTimeAsync(2000);

    send({ type: 'setMode', mode: 'blind' });
    editShow({ type: 'putScene', scene: { ...wash, rules: [{ target: {}, intensity: 0.2 }] } });
    await vi.advanceTimersByTimeAsync(500);

    expect(level()).toBe(255);
    expect(light()).toEqual({ intensity: 0.2, ...white });

    send({ type: 'setMode', mode: 'monitor' });
    await vi.advanceTimersByTimeAsync(100);
    expect(level()).toBe(51);
  });

  it('does not change the frames sent to the Outputs', async () => {
    const watched = await playbackEngine();
    const unwatched = await playbackEngine();
    const engines = [watched, unwatched];
    watched.send({ type: 'startPreview' });
    const before = engines.map((e) => e.writes().length);

    for (const e of engines) e.send({ type: 'goScene', sceneId: 'wash' });
    await vi.advanceTimersByTimeAsync(3000);

    const [a, b] = engines.map((e, i) =>
      e
        .writes()
        .slice(before[i])
        .map((w) => w.join()),
    );
    expect(a!.length).toBeGreaterThan(110);
    expect(a).toEqual(b);
  });
});

// Dimmer, shutter (closed 0–31, open 32–63), red, green, blue, pan, tilt.
const mover: FixtureProfile = {
  id: 'acme/mover',
  manufacturer: 'Acme',
  model: 'Mover',
  defaultRole: 'Spot/Beam',
  modes: [
    {
      name: '7ch',
      channels: [
        control('Dimmer', [{ from: 0, to: 255, capability: { type: 'intensity' } }]),
        control('Shutter', [
          { from: 0, to: 31, capability: { type: 'shutter', effect: 'closed' } },
          { from: 32, to: 63, capability: { type: 'shutter', effect: 'open' } },
        ]),
        control('Red', [{ from: 0, to: 255, capability: { type: 'emitter', emitter: 'red' } }]),
        control('Green', [{ from: 0, to: 255, capability: { type: 'emitter', emitter: 'green' } }]),
        control('Blue', [{ from: 0, to: 255, capability: { type: 'emitter', emitter: 'blue' } }]),
        control('Pan', [{ from: 0, to: 255, capability: { type: 'pan', degrees: [-270, 270] } }]),
        control('Tilt', [{ from: 0, to: 255, capability: { type: 'tilt', degrees: [-135, 135] } }]),
      ],
    },
  ],
};

function control(name: string, ranges: CapabilityRange[]): Channel {
  return { kind: 'control', name, defaultValue: 0, ranges };
}

// The mover hung 6 m up on Stage Left at address 1, and a dimmer at 10, both
// in Universe 1, sent to COM3. `cross` sets everything to 40% Red, aimed at
// Cross; it is active. `files` stands in for the disk, by path.
async function focusEngine() {
  const serial = fakeSerial();
  const events: EngineEvent[] = [];
  const files = new Map<string, string>();
  const engine = createEngine({
    emit: (e) => events.push(e),
    now: () => Date.now(),
    serialPorts: serial.ports,
    venueFiles: {
      read: (path) => files.get(path) ?? '',
      write: (path, json) => void files.set(path, json),
    },
  });
  let requestId = 1;
  engine.handle({ type: 'saveProfile', requestId: requestId++, profile: dimmer });
  engine.handle({ type: 'saveProfile', requestId: requestId++, profile: mover });
  const moverFixture: PatchedFixture = {
    ...{ id: 'm1', name: 'Mover 1', profileId: 'acme/mover', mode: '7ch' },
    ...{ universe: 1, address: 1, x: 3, y: 4, height: 6 },
  };
  const editVenue = (edit: VenueEdit) =>
    engine.handle({ type: 'editVenue', requestId: requestId++, edit });
  editVenue({ type: 'putUniverse', universe: { number: 1, output: 'EN1' } });
  editVenue({ type: 'putFixture', fixture: moverFixture });
  editVenue({
    type: 'putFixture',
    fixture: {
      ...{ id: 'd1', name: 'Dimmer 1', profileId: 'acme/dimmer', mode: '1ch' },
      ...{ universe: 1, address: 10, x: 0, y: 1, height: 0 },
    },
  });
  const cross: Scene = {
    ...{ id: 'cross', name: 'Cross', tags: [], layer: 'layer-1', fadeIn: 0 },
    rules: [{ target: {}, intensity: 0.4, colour: { swatch: 'Red' }, direction: 'Cross' }],
  };
  engine.handle({
    type: 'editShow',
    requestId: requestId++,
    edit: { type: 'putScene', scene: cross },
  });
  engine.handle({ type: 'goScene', sceneId: 'cross' });
  serial.plug('COM3', 'EN1');
  await vi.advanceTimersByTimeAsync(1000);

  return {
    events,
    files,
    editProfile: (profile: FixtureProfile) =>
      engine.handle({ type: 'saveProfile', requestId: requestId++, profile }),
    moverFixture,
    editVenue,
    send: (command: EngineCommand) => engine.handle(command),
    // The mover's 7 channels in the latest frame sent.
    moverChannels: () => [...(serial.port('COM3')?.writes.at(-1)?.subarray(5, 12) ?? [])],
    // The dimmer's level in the latest frame sent.
    dimmer: () => serial.port('COM3')?.writes.at(-1)?.[14],
    // The Focus Check the engine reported last.
    focusCheck() {
      const event = events.findLast((e) => e.type === 'playback');
      return event?.type === 'playback' ? event.focusCheck : undefined;
    },
  };
}

// Full, shutter open (the middle of 32–63), white, pan and tilt at the centre.
const FOCUS_DOWN = [255, 47, 255, 255, 255, 128, 128];

describe('engine Focus Check', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends every mover open in white to the Direction, leaving the others to the Show', async () => {
    const { send, moverChannels, dimmer, focusCheck } = await focusEngine();
    const showing = moverChannels();
    expect(showing.slice(0, 5)).toEqual([102, 47, 255, 0, 0]);

    send({ type: 'setFocusCheck', direction: 'Down' });
    await vi.advanceTimersByTimeAsync(100);

    expect(moverChannels()).toEqual(FOCUS_DOWN);
    expect(dimmer()).toBe(102);
    expect(focusCheck()).toBe('Down');

    send({ type: 'setFocusCheck' });
    await vi.advanceTimersByTimeAsync(100);
    expect(moverChannels()).toEqual(showing);
    expect(focusCheck()).toBeUndefined();
  });

  it('reaches the Outputs in Blind too, which still hold the others', async () => {
    const { send, moverChannels, dimmer } = await focusEngine();
    const held = moverChannels();
    send({ type: 'setMode', mode: 'blind' });
    send({ type: 'clearLayer', layerId: 'layer-1' });

    send({ type: 'setFocusCheck', direction: 'Down' });
    await vi.advanceTimersByTimeAsync(100);
    expect(moverChannels()).toEqual(FOCUS_DOWN);
    expect(dimmer()).toBe(102);

    send({ type: 'setFocusCheck' });
    await vi.advanceTimersByTimeAsync(100);
    expect(moverChannels()).toEqual(held);
  });

  it('goes dark under Blackout, in Monitor and in Blind', async () => {
    const { send, moverChannels, dimmer } = await focusEngine();
    send({ type: 'setFocusCheck', direction: 'Down' });
    const dark = [0, ...FOCUS_DOWN.slice(1)];

    send({ type: 'setBlackout', on: true });
    await vi.advanceTimersByTimeAsync(100);
    expect(moverChannels()).toEqual(dark);
    expect(dimmer()).toBe(0);

    send({ type: 'setMode', mode: 'blind' });
    await vi.advanceTimersByTimeAsync(100);
    expect(moverChannels()).toEqual(dark);

    send({ type: 'setBlackout', on: false });
    await vi.advanceTimersByTimeAsync(100);
    expect(moverChannels()).toEqual(FOCUS_DOWN);
  });

  it('follows edits to position, Mounting and Profile live', async () => {
    const { send, editVenue, editProfile, moverFixture, moverChannels } = await focusEngine();
    send({ type: 'setFocusCheck', direction: 'Centre' });
    await vi.advanceTimersByTimeAsync(100);
    expect(moverChannels().slice(5)).not.toEqual([128, 128]);

    // Straight above centre stage (the stage is 8 m deep): the beam drops along the yoke axis.
    editVenue({ type: 'moveFixture', id: 'm1', position: { x: 0, y: 4, height: 6 } });
    await vi.advanceTimersByTimeAsync(100);
    expect(moverChannels().slice(5)).toEqual([128, 128]);

    // Tilt 27° off: -27° of the 270° range is 40% across it.
    editVenue({
      type: 'putFixture',
      fixture: {
        ...moverFixture,
        x: 0,
        y: 4,
        mounting: { ...DEFAULT_MOUNTING, tiltOffset: 27 },
      },
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(moverChannels().slice(5)).toEqual([128, 102]);

    // Tilt over 180° instead: -27° is 35% across it.
    const narrow = structuredClone(mover);
    narrow.id = 'acme/narrow-mover';
    narrow.modes[0]!.channels[6] = control('Tilt', [
      { from: 0, to: 255, capability: { type: 'tilt', degrees: [-90, 90] } },
    ]);
    editProfile(narrow);
    editVenue({
      type: 'putFixture',
      fixture: {
        ...moverFixture,
        profileId: narrow.id,
        x: 0,
        y: 4,
        mounting: { ...DEFAULT_MOUNTING, tiltOffset: 27 },
      },
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(moverChannels().slice(5)).toEqual([128, 89]);
  });

  it('ends on New and Open of a Venue Patch', async () => {
    const { send, focusCheck } = await focusEngine();
    send({ type: 'setFocusCheck', direction: 'Up' });
    send({ type: 'saveVenue', requestId: 100, path: 'rig.lcvenue' });

    send({ type: 'openVenue', requestId: 101, path: 'rig.lcvenue' });
    expect(focusCheck()).toBeUndefined();

    send({ type: 'setFocusCheck', direction: 'Up' });
    send({ type: 'newVenue' });
    expect(focusCheck()).toBeUndefined();
  });

  it('is neither saved with the Venue Patch nor undone', async () => {
    const { send, files, editVenue, focusCheck } = await focusEngine();
    send({ type: 'setFocusCheck', direction: 'Up' });

    send({ type: 'saveVenue', requestId: 100, path: 'rig.lcvenue' });
    expect(files.get('rig.lcvenue')).not.toContain('Up');
    editVenue({ type: 'setStage', stage: { width: 14, depth: 8 } });
    send({ type: 'undoVenue' });
    send({ type: 'redoVenue' });

    expect(focusCheck()).toBe('Up');
  });
});
