import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ActiveByLayer,
  EngineEvent,
  MidiInputStatus,
  ShowEdit,
  TempoSource,
} from '../shared/protocol';
import type { Scene, Trigger } from '../shared/show';
import { createEngine } from './engine';
import type { MidiPorts } from './midi-input';

// Stands in for the machine's MIDI inputs, by port name. `send` delivers a
// message to the open connection on that port, if any.
function fakeMidi() {
  const listed = new Set<string>();
  const connections: { name: string; onMessage: (m: number[]) => void; closed: boolean }[] = [];
  const failing = new Set<string>();

  const ports: MidiPorts = {
    list: () => [...listed],
    open(name, onMessage) {
      if (failing.has(name)) throw new Error('Port busy');
      const connection = { name, onMessage, closed: false };
      connections.push(connection);
      return { close: () => void (connection.closed = true) };
    },
  };

  return {
    ports,
    plug: (name: string) => void listed.add(name),
    // The port disappears from the list. RtMidi does not tell an open port.
    unplug: (name: string) => void listed.delete(name),
    failOpening: (name: string, fail = true) => (fail ? failing.add(name) : failing.delete(name)),
    open: () => connections.filter((c) => !c.closed).map((c) => c.name),
    send(name: string, message: number[]) {
      connections.filter((c) => c.name === name && !c.closed).forEach((c) => c.onMessage(message));
    },
  };
}

const noteOn = (channel: number, note: number, velocity = 100) => [
  0x90 | (channel - 1),
  note,
  velocity,
];
const noteOff = (channel: number, note: number) => [0x80 | (channel - 1), note, 64];

function scene(id: string, layer = 'layer-1'): Scene {
  return { id, name: id, tags: [], layer, fadeIn: 0, rules: [{ target: {}, intensity: 1 }] };
}

// `saved` stands in for the file the selected MIDI input is kept in.
function midiEngine(midi = fakeMidi(), saved: { json?: string } = {}) {
  const events: EngineEvent[] = [];
  const midiInputStorage = {
    read: () => saved.json,
    write: (json: string) => void (saved.json = json),
  };
  const engine = createEngine({
    emit: (e) => events.push(e),
    midiPorts: midi.ports,
    midiInputStorage,
  });
  let requestId = 1;

  function edit(edit: ShowEdit): string[] {
    const id = requestId++;
    engine.handle({ type: 'editShow', requestId: id, edit });
    const reply = events.find((e) => e.type === 'showDone' && e.requestId === id);
    return reply?.type === 'showDone' ? reply.errors : ['No reply'];
  }

  return {
    midi,
    engine,
    events,
    edit,
    scenes(...scenes: Scene[]) {
      for (const s of scenes) edit({ type: 'putScene', scene: s });
    },
    map: (trigger: Trigger) => edit({ type: 'putTrigger', trigger }),
    select: (name?: string) => engine.handle({ type: 'selectMidiInput', name }),
    // The active Scenes the engine reported last.
    active(): ActiveByLayer {
      engine.handle({ type: 'getPlayback' });
      const event = events.findLast((e) => e.type === 'playback');
      return event?.type === 'playback' ? event.active : {};
    },
    // The Triggers of the Show the engine reported last.
    triggers(): Trigger[] {
      const event = events.findLast((e) => e.type === 'show');
      return event?.type === 'show' ? event.show.triggers : [];
    },
    // The Tempo the engine reported last.
    tempo(): { bpm: number; source: TempoSource } | undefined {
      engine.handle({ type: 'getTempo' });
      const event = events.findLast((e) => e.type === 'tempo');
      return event?.type === 'tempo' ? { bpm: event.bpm, source: event.source } : undefined;
    },
    // The MIDI input status the engine reported last.
    status(): MidiInputStatus | undefined {
      const event = events.findLast((e) => e.type === 'midiInput');
      return event?.type === 'midiInput' ? event.status : undefined;
    },
  };
}

describe('engine MIDI Triggers', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('activates a Scene with a Go Trigger, and it stays on after note-off', async () => {
    const { midi, scenes, map, select, active } = midiEngine();
    midi.plug('rtpMIDI Session');
    scenes(scene('wash'));
    map({ channel: 1, note: 60, scene: 'wash', mode: 'go' });
    select('rtpMIDI Session');
    await vi.advanceTimersByTimeAsync(1000);

    midi.send('rtpMIDI Session', noteOn(1, 60));
    midi.send('rtpMIDI Session', noteOff(1, 60));

    expect(active()).toEqual({ 'layer-1': 'wash' });
  });

  it("clears the Scene's Layer with a Release Trigger, leaving other Layers on", async () => {
    const { midi, edit, scenes, map, select, active } = midiEngine();
    midi.plug('Pads');
    edit({ type: 'putLayer', layer: { id: 'layer-2', name: 'Accents' } });
    scenes(scene('wash'), scene('verse'), scene('strobe', 'layer-2'));
    map({ channel: 1, note: 60, scene: 'wash', mode: 'go' });
    map({ channel: 1, note: 61, scene: 'strobe', mode: 'go' });
    map({ channel: 1, note: 62, scene: 'verse', mode: 'release' });
    select('Pads');
    await vi.advanceTimersByTimeAsync(1000);

    midi.send('Pads', noteOn(1, 60));
    midi.send('Pads', noteOn(1, 61));
    midi.send('Pads', noteOn(1, 62));

    expect(active()).toEqual({ 'layer-2': 'strobe' });
  });

  it('activates a Scene with a Flash Trigger while held, then restores the Layer', async () => {
    const { midi, scenes, map, select, active } = midiEngine();
    midi.plug('Pads');
    scenes(scene('wash'), scene('blinder'));
    map({ channel: 1, note: 60, scene: 'wash', mode: 'go' });
    map({ channel: 10, note: 36, scene: 'blinder', mode: 'flash' });
    select('Pads');
    await vi.advanceTimersByTimeAsync(1000);

    midi.send('Pads', noteOn(10, 36));
    expect(active()).toEqual({ 'layer-1': 'blinder' });
    midi.send('Pads', noteOff(10, 36));
    expect(active()).toEqual({});

    midi.send('Pads', noteOn(1, 60));
    midi.send('Pads', noteOn(10, 36));
    expect(active()).toEqual({ 'layer-1': 'blinder' });
    // A note-on with velocity 0 is a note-off.
    midi.send('Pads', noteOn(10, 36, 0));
    expect(active()).toEqual({ 'layer-1': 'wash' });
  });

  it('restores nothing after a Flash that a Go or Clear from the UI replaced', async () => {
    const { midi, engine, scenes, map, select, active } = midiEngine();
    midi.plug('Pads');
    scenes(scene('wash'), scene('verse'), scene('blinder'));
    map({ channel: 1, note: 36, scene: 'blinder', mode: 'flash' });
    select('Pads');
    await vi.advanceTimersByTimeAsync(1000);
    engine.handle({ type: 'goScene', sceneId: 'wash' });

    midi.send('Pads', noteOn(1, 36));
    engine.handle({ type: 'goScene', sceneId: 'verse' });
    midi.send('Pads', noteOff(1, 36));
    expect(active()).toEqual({ 'layer-1': 'verse' });

    midi.send('Pads', noteOn(1, 36));
    engine.handle({ type: 'clearLayer', layerId: 'layer-1' });
    midi.send('Pads', noteOff(1, 36));
    expect(active()).toEqual({});
  });

  it('clears the Layer after a Flash when the Scene it held was removed meanwhile', async () => {
    const { midi, engine, edit, scenes, map, select, active } = midiEngine();
    midi.plug('Pads');
    scenes(scene('wash'), scene('blinder'));
    map({ channel: 1, note: 36, scene: 'blinder', mode: 'flash' });
    select('Pads');
    await vi.advanceTimersByTimeAsync(1000);
    engine.handle({ type: 'goScene', sceneId: 'wash' });

    midi.send('Pads', noteOn(1, 36));
    edit({ type: 'removeScene', id: 'wash' });
    midi.send('Pads', noteOff(1, 36));

    expect(active()).toEqual({});
  });

  it('lists MIDI inputs and reports the selected one as connected', async () => {
    const { midi, engine, select, status } = midiEngine();
    midi.plug('Pads');
    midi.plug('rtpMIDI Session');
    await vi.advanceTimersByTimeAsync(1000);
    expect(status()).toEqual({ ports: ['Pads', 'rtpMIDI Session'], state: 'none' });

    select('Pads');
    expect(status()).toEqual({
      ports: ['Pads', 'rtpMIDI Session'],
      selected: 'Pads',
      state: 'connected',
    });
    expect(midi.open()).toEqual(['Pads']);

    select(undefined);
    engine.handle({ type: 'listMidiInputs' });
    expect(status()).toEqual({ ports: ['Pads', 'rtpMIDI Session'], state: 'none' });
    expect(midi.open()).toEqual([]);
  });

  it('holds the current look when the port is lost, and listens again when it returns', async () => {
    const { midi, scenes, map, select, active, status } = midiEngine();
    midi.plug('Pads');
    scenes(scene('wash'), scene('blinder'));
    map({ channel: 1, note: 60, scene: 'wash', mode: 'go' });
    map({ channel: 1, note: 36, scene: 'blinder', mode: 'flash' });
    select('Pads');
    midi.send('Pads', noteOn(1, 36));

    midi.unplug('Pads');
    await vi.advanceTimersByTimeAsync(1000);
    expect(status()).toEqual({ ports: [], selected: 'Pads', state: 'lost' });
    expect(midi.open()).toEqual([]);
    expect(active()).toEqual({ 'layer-1': 'blinder' });

    midi.plug('Pads');
    await vi.advanceTimersByTimeAsync(1000);
    expect(status()).toEqual({ ports: ['Pads'], selected: 'Pads', state: 'connected' });
    midi.send('Pads', noteOff(1, 36));
    expect(active()).toEqual({});
    midi.send('Pads', noteOn(1, 60));
    expect(active()).toEqual({ 'layer-1': 'wash' });
  });

  it('reports a port that does not open as failed, and retries it on the next scan', async () => {
    const { midi, select, status } = midiEngine();
    midi.plug('Pads');
    midi.failOpening('Pads');
    select('Pads');
    expect(status()).toEqual({
      ports: ['Pads'],
      selected: 'Pads',
      state: 'failed',
      error: 'Port busy',
    });

    midi.failOpening('Pads', false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(status()).toEqual({ ports: ['Pads'], selected: 'Pads', state: 'connected' });
  });

  it('learns the next note-on instead of firing its Trigger, until cancelled', async () => {
    const { midi, engine, events, scenes, map, select, active } = midiEngine();
    midi.plug('Pads');
    scenes(scene('wash'));
    map({ channel: 1, note: 60, scene: 'wash', mode: 'go' });
    select('Pads');
    const learned = () => events.filter((e) => e.type === 'triggerLearned');

    engine.handle({ type: 'learnTrigger' });
    midi.send('Pads', noteOff(2, 12));
    midi.send('Pads', [0xb0, 7, 100]);
    midi.send('Pads', noteOn(1, 60));
    midi.send('Pads', noteOn(16, 127));

    expect(learned()).toEqual([{ type: 'triggerLearned', note: { channel: 1, note: 60 } }]);
    expect(active()).toEqual({});

    engine.handle({ type: 'learnTrigger' });
    engine.handle({ type: 'cancelLearn' });
    midi.send('Pads', noteOn(1, 60));
    expect(learned()).toHaveLength(1);
    expect(active()).toEqual({ 'layer-1': 'wash' });
  });

  it('maps a learned note to a Scene, replacing the Trigger on it, and removes it', () => {
    const { edit, scenes, map, triggers } = midiEngine();
    scenes(scene('wash'), scene('blinder'));
    expect(map({ channel: 1, note: 60, scene: 'wash', mode: 'go' })).toEqual([]);
    expect(map({ channel: 1, note: 60, scene: 'blinder', mode: 'flash' })).toEqual([]);
    expect(triggers()).toEqual([{ channel: 1, note: 60, scene: 'blinder', mode: 'flash' }]);
    expect(map({ channel: 1, note: 61, scene: 'gone', mode: 'go' })).toEqual([
      'Trigger 1/61: Scene "gone" is not in the Show',
    ]);
    expect(edit({ type: 'removeTrigger', note: { channel: 1, note: 60 } })).toEqual([]);
    expect(edit({ type: 'removeTrigger', note: { channel: 1, note: 60 } })).toEqual([
      'No Trigger is mapped to channel 1, note 60',
    ]);
    expect(triggers()).toEqual([]);
  });

  it('releases a held Flash during MIDI learn', async () => {
    const { midi, engine, events, scenes, map, select, active } = midiEngine();
    midi.plug('Pads');
    scenes(scene('blinder'));
    map({ channel: 1, note: 36, scene: 'blinder', mode: 'flash' });
    select('Pads');

    midi.send('Pads', noteOn(1, 36));
    engine.handle({ type: 'learnTrigger' });
    midi.send('Pads', noteOff(1, 36));

    expect(active()).toEqual({});
    expect(events.filter((e) => e.type === 'triggerLearned')).toEqual([]);
  });

  it('releases a held Flash when its Trigger was changed or removed meanwhile', async () => {
    const { midi, edit, scenes, map, select, active } = midiEngine();
    midi.plug('Pads');
    scenes(scene('wash'), scene('blinder'));
    map({ channel: 1, note: 36, scene: 'blinder', mode: 'flash' });
    select('Pads');

    midi.send('Pads', noteOn(1, 36));
    map({ channel: 1, note: 36, scene: 'wash', mode: 'go' });
    midi.send('Pads', noteOff(1, 36));
    expect(active()).toEqual({});

    map({ channel: 1, note: 36, scene: 'blinder', mode: 'flash' });
    midi.send('Pads', noteOn(1, 36));
    edit({ type: 'removeTrigger', note: { channel: 1, note: 36 } });
    midi.send('Pads', noteOff(1, 36));
    expect(active()).toEqual({});
  });

  it('keeps the latest of overlapping Flashes on a Layer, and restores the Scene from before both', async () => {
    const { midi, engine, scenes, map, select, active } = midiEngine();
    midi.plug('Pads');
    scenes(scene('wash'), scene('blinder'), scene('strobe'));
    map({ channel: 1, note: 36, scene: 'blinder', mode: 'flash' });
    map({ channel: 1, note: 37, scene: 'strobe', mode: 'flash' });
    select('Pads');
    engine.handle({ type: 'goScene', sceneId: 'wash' });

    midi.send('Pads', noteOn(1, 36));
    midi.send('Pads', noteOn(1, 37));
    midi.send('Pads', noteOff(1, 36));
    expect(active()).toEqual({ 'layer-1': 'strobe' });
    midi.send('Pads', noteOff(1, 37));
    expect(active()).toEqual({ 'layer-1': 'wash' });
  });

  it('reopens the MIDI input selected last time, and waits for it when it is not there yet', async () => {
    const midi = fakeMidi();
    const saved = {};
    midiEngine(midi, saved).select('Pads');

    const { status } = midiEngine(midi, saved);
    expect(status()).toEqual({ ports: [], selected: 'Pads', state: 'lost' });
    midi.plug('Pads');
    await vi.advanceTimersByTimeAsync(1000);
    expect(status()).toEqual({ ports: ['Pads'], selected: 'Pads', state: 'connected' });

    midiEngine(midi, saved).select(undefined);
    expect(midiEngine(midi, saved).status()).toEqual({ ports: ['Pads'], state: 'none' });
  });

  it('starts without a MIDI input when the saved one is unreadable', () => {
    const { status } = midiEngine(fakeMidi(), { json: '{not json' });
    expect(status()).toEqual({ ports: [], state: 'none' });
  });
});

describe('engine Tempo', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('takes the Tempo from MIDI Clock on the MIDI Input, ignoring Start and Stop', async () => {
    const { midi, select, tempo } = midiEngine();
    midi.plug('DAW');
    select('DAW');
    expect(tempo()).toEqual({ bpm: 120, source: 'default' });

    midi.send('DAW', [0xfa]);
    // Two beats at 125 BPM: 20 ms a tick.
    for (let i = 0; i < 49; i++) {
      midi.send('DAW', [0xf8]);
      await vi.advanceTimersByTimeAsync(20);
    }
    midi.send('DAW', [0xfc]);

    expect(tempo()?.source).toBe('clock');
    expect(tempo()?.bpm).toBeCloseTo(125, 6);
  });

  it('sets the Tempo from Tap Tempo', async () => {
    const { engine, tempo } = midiEngine();
    engine.handle({ type: 'tapTempo' });
    await vi.advanceTimersByTimeAsync(400);
    engine.handle({ type: 'tapTempo' });

    expect(tempo()?.source).toBe('tap');
    expect(tempo()?.bpm).toBeCloseTo(150, 6);
  });
});
