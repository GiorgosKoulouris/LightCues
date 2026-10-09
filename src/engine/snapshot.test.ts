import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineEvent, EngineSnapshot, PlaybackSnapshot, ShowEdit } from '../shared/protocol';
import type { Scene } from '../shared/show';
import { createEngine } from './engine';
import type { MidiPorts } from './midi-input';
import { PLAYBACK_PART_MS } from './snapshot-reporter';

function scene(id: string, layer = 'layer-1'): Scene {
  return { id, name: id, tags: [], layer, fadeIn: 0, rules: [{ target: {}, intensity: 1 }] };
}

// MIDI input ports that are always there. `send` delivers to the open port.
function fakeMidi(names: string[]) {
  const open = new Map<string, (message: number[]) => void>();
  const ports: MidiPorts = {
    list: () => names,
    open(name, onMessage) {
      open.set(name, onMessage);
      return { close: () => void open.delete(name) };
    },
  };
  return { ports, send: (name: string, message: number[]) => open.get(name)?.(message) };
}

// An engine whose snapshot parts are kept in `parts`, after the full
// snapshot. `files` stands in for the disk, by path.
function snapshotEngine(midi = fakeMidi(['Pads', 'Keys'])) {
  const events: EngineEvent[] = [];
  const parts: Partial<EngineSnapshot>[] = [];
  const files = new Map<string, string>();
  const documentFiles = {
    read(path: string) {
      const json = files.get(path);
      if (json === undefined) throw new Error(`ENOENT: ${path}`);
      return json;
    },
    write: (path: string, json: string) => void files.set(path, json),
  };
  const clock = { now: 0 };
  const engine = createEngine({
    emit: (e) => events.push(e),
    report: (part) => parts.push(part),
    now: () => clock.now,
    showFiles: documentFiles,
    venueFiles: documentFiles,
    midiPorts: midi.ports,
  });
  const full = engine.snapshot();
  let requestId = 1;
  const editShow = (edit: ShowEdit) =>
    engine.handle({ type: 'editShow', requestId: requestId++, edit });

  return {
    engine,
    events,
    parts,
    full,
    clock,
    midi,
    editShow,
    scenes: (...scenes: Scene[]) => scenes.forEach((s) => editShow({ type: 'putScene', scene: s })),
    // The parts reported since the last call.
    take: () => parts.splice(0),
    saveShow(path: string) {
      engine.grantPath(path);
      engine.handle({ type: 'saveShow', requestId: requestId++, path });
    },
    openShow(path: string) {
      engine.grantPath(path);
      engine.handle({ type: 'openShow', requestId: requestId++, path });
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('engine snapshot', () => {
  it('starts whole: documents, playback, Tempo and MIDI Input', () => {
    const { full } = snapshotEngine();

    expect(full).toEqual({
      show: { document: expect.objectContaining({ scenes: [] }), unsaved: false },
      venue: { document: expect.objectContaining({ fixtures: [] }), unsaved: false },
      playback: {
        active: [],
        mode: 'monitor',
        grandMaster: 1,
        blackout: false,
        freeze: false,
        bpm: 120,
        tempoSource: 'default',
      },
      midiInput: {},
    });
  });

  it('reports nothing before the full snapshot is taken', () => {
    const parts: Partial<EngineSnapshot>[] = [];
    const engine = createEngine({ emit: () => {}, report: (part) => parts.push(part) });

    engine.handle({ type: 'setBlackout', on: true });

    expect(parts).toEqual([]);
  });

  it('sends the Show on each edit, save, open and undo, with its unsaved state', () => {
    const { take, scenes, saveShow, openShow, engine } = snapshotEngine();

    scenes(scene('wash'));
    expect(take()).toEqual([{ show: expect.objectContaining({ unsaved: true }) }]);

    saveShow('C:/gigs/tour.lcshow');
    expect(take()).toEqual([
      { show: expect.objectContaining({ unsaved: false, path: 'C:/gigs/tour.lcshow' }) },
    ]);

    scenes(scene('spot'));
    engine.handle({ type: 'undoShow' });
    const [edited, undone] = take();
    expect(edited?.show?.unsaved).toBe(true);
    expect(undone?.show?.unsaved).toBe(false);
    expect(undone?.show?.document.scenes.map((s) => s.id)).toEqual(['wash']);

    engine.handle({ type: 'newShow' });
    take();
    openShow('C:/gigs/tour.lcshow');
    const [opened] = take().filter((p) => p.show);
    expect(opened?.show).toMatchObject({ path: 'C:/gigs/tour.lcshow', unsaved: false });
    expect(opened?.show?.document.scenes.map((s) => s.id)).toEqual(['wash']);
  });

  it('sends the Venue Patch on each edit and undo, with its unsaved state', () => {
    const { take, engine } = snapshotEngine();

    engine.handle({
      type: 'editVenue',
      requestId: 1,
      edit: { type: 'setStage', stage: { width: 12, depth: 9 } },
    });
    expect(take()).toEqual([
      {
        venue: expect.objectContaining({
          unsaved: true,
          document: expect.objectContaining({ stage: { width: 12, depth: 9 } }),
        }),
      },
    ]);

    engine.handle({ type: 'undoVenue' });
    expect(take()).toEqual([{ venue: expect.objectContaining({ unsaved: false }) }]);
  });

  it('sends no document part when nothing changed', () => {
    const { take, engine } = snapshotEngine();

    engine.handle({ type: 'getShow' });
    engine.handle({ type: 'getVenue' });
    engine.handle({ type: 'undoShow' });

    expect(take()).toEqual([]);
  });

  it.each<[string, (s: ReturnType<typeof snapshotEngine>) => void, Partial<PlaybackSnapshot>]>([
    [
      'Go',
      (s) => s.engine.handle({ type: 'goScene', sceneId: 'wash' }),
      { active: [{ layer: 'layer-1', scene: 'wash' }] },
    ],
    [
      'Grand Master',
      (s) => s.engine.handle({ type: 'setGrandMaster', level: 0.5 }),
      { grandMaster: 0.5 },
    ],
    ['Blackout', (s) => s.engine.handle({ type: 'setBlackout', on: true }), { blackout: true }],
    ['Freeze', (s) => s.engine.handle({ type: 'setFreeze', on: true }), { freeze: true }],
    ['mode', (s) => s.engine.handle({ type: 'setMode', mode: 'blind' }), { mode: 'blind' }],
    [
      'Tap Tempo',
      (s) => {
        s.engine.handle({ type: 'tapTempo' });
        s.clock.now = 500;
        s.engine.handle({ type: 'tapTempo' });
      },
      { bpm: 120, tempoSource: 'tap' },
    ],
  ])('sends a playback part on %s', (_name, act, expected) => {
    const s = snapshotEngine();
    s.scenes(scene('wash'));
    s.take();

    act(s);
    vi.advanceTimersByTime(PLAYBACK_PART_MS);

    expect(s.take().at(-1)?.playback).toMatchObject(expected);
  });

  it('sends a playback part on a Trigger Go, Flash and Release', () => {
    const s = snapshotEngine();
    s.scenes(scene('wash'), scene('spot'));
    s.editShow({
      type: 'putTrigger',
      trigger: { channel: 1, note: 60, scene: 'wash', mode: 'go' },
    });
    s.editShow({
      type: 'putTrigger',
      trigger: { channel: 1, note: 61, scene: 'spot', mode: 'flash' },
    });
    s.editShow({
      type: 'putTrigger',
      trigger: { channel: 1, note: 62, scene: 'wash', mode: 'release' },
    });
    s.engine.handle({ type: 'selectMidiInput', name: 'Pads' });
    const playback = () => {
      vi.advanceTimersByTime(PLAYBACK_PART_MS);
      return s.take().findLast((p) => p.playback)?.playback?.active;
    };
    s.take();

    s.midi.send('Pads', [0x90, 60, 100]);
    expect(playback()).toEqual([{ layer: 'layer-1', scene: 'wash' }]);
    s.midi.send('Pads', [0x90, 61, 100]);
    expect(playback()).toEqual([{ layer: 'layer-1', scene: 'spot' }]);
    s.midi.send('Pads', [0x80, 61, 0]);
    expect(playback()).toEqual([{ layer: 'layer-1', scene: 'wash' }]);
    s.midi.send('Pads', [0x90, 62, 100]);
    expect(playback()).toEqual([]);
  });

  it('sends a burst of Grand Master moves at most once per 100 ms, the last one last', () => {
    const { take, engine } = snapshotEngine();

    for (let i = 1; i <= 20; i++) {
      engine.handle({ type: 'setGrandMaster', level: i / 20 });
      vi.advanceTimersByTime(10);
    }
    vi.advanceTimersByTime(PLAYBACK_PART_MS);

    const levels = take().map((p) => p.playback?.grandMaster);
    expect(levels.length).toBeLessThanOrEqual(1 + 200 / PLAYBACK_PART_MS + 1);
    expect(levels[0]).toBe(0.05);
    expect(levels.at(-1)).toBe(1);
  });

  it('lists active Scenes in the order they were activated', () => {
    const { engine, editShow, scenes } = snapshotEngine();
    editShow({ type: 'putLayer', layer: { id: 'layer-2', name: 'Accents' } });
    scenes(scene('wash'), scene('strobe', 'layer-2'));

    engine.handle({ type: 'goScene', sceneId: 'strobe' });
    engine.handle({ type: 'goScene', sceneId: 'wash' });

    expect(engine.snapshot().playback.active).toEqual([
      { layer: 'layer-2', scene: 'strobe' },
      { layer: 'layer-1', scene: 'wash' },
    ]);
  });

  it('sends the MIDI Input when the selection changes', () => {
    const { take, engine } = snapshotEngine();

    engine.handle({ type: 'selectMidiInput', name: 'Keys' });
    vi.advanceTimersByTime(1000);

    expect(take()).toEqual([{ midiInput: { selected: 'Keys' } }]);
  });
});

describe('engine restore', () => {
  // The snapshot of an engine with two Layers live, unsaved edits, and every
  // playback setting changed.
  function liveSnapshot(): EngineSnapshot {
    const s = snapshotEngine();
    s.editShow({ type: 'putLayer', layer: { id: 'layer-2', name: 'Accents' } });
    s.scenes(scene('base'), scene('wash'), scene('strobe', 'layer-2'));
    s.editShow({ type: 'setBaseLook', sceneId: 'base' });
    s.saveShow('C:/gigs/tour.lcshow');
    s.scenes(scene('spot'));
    s.engine.handle({ type: 'goScene', sceneId: 'strobe' });
    s.engine.handle({ type: 'goScene', sceneId: 'wash' });
    s.engine.handle({ type: 'setGrandMaster', level: 0.6 });
    s.engine.handle({ type: 'setBlackout', on: true });
    s.engine.handle({ type: 'setFreeze', on: true });
    s.engine.handle({ type: 'setMode', mode: 'blind' });
    s.engine.handle({ type: 'tapTempo' });
    s.clock.now = 400;
    s.engine.handle({ type: 'tapTempo' });
    s.engine.handle({ type: 'selectMidiInput', name: 'Keys' });
    return s.engine.snapshot();
  }

  it('brings back the documents, unsaved state, live look, Tempo and MIDI Input', () => {
    const before = liveSnapshot();
    const after = snapshotEngine();

    expect(after.engine.restore(before)).toBe('restored');

    expect(after.engine.snapshot()).toEqual(before);
    expect(before.show).toMatchObject({ path: 'C:/gigs/tour.lcshow', unsaved: true });
    expect(before.playback).toMatchObject({
      mode: 'blind',
      blackout: true,
      freeze: true,
      bpm: 150,
    });
  });

  it('can save the restored Show to its file, which it holds again', () => {
    const before = liveSnapshot();
    const after = snapshotEngine();
    after.engine.restore(before);

    after.engine.handle({ type: 'saveShow', requestId: 99 });

    expect(after.events).toContainEqual({ type: 'showDone', requestId: 99, errors: [] });
    expect(after.engine.snapshot().show.unsaved).toBe(false);
  });

  it('holds a MIDI Clock Tempo until the clock ticks again', () => {
    const before = liveSnapshot();
    const after = snapshotEngine();

    after.engine.restore({ ...before, playback: { ...before.playback, tempoSource: 'clock' } });

    expect(after.engine.snapshot().playback).toMatchObject({ bpm: 150, tempoSource: 'held' });
  });

  it('falls back to the Base Look, with Blackout and Grand Master kept, when the live look fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const before = liveSnapshot();
    const after = snapshotEngine();
    const broken = { ...before, playback: { ...before.playback, active: 'broken' as never } };

    expect(after.engine.restore(broken)).toBe('baseLook');

    const { show, playback } = after.engine.snapshot();
    expect(show).toEqual(before.show);
    expect(playback).toMatchObject({
      active: [{ layer: 'layer-1', scene: 'base' }],
      grandMaster: 0.6,
      blackout: true,
      freeze: false,
      mode: 'monitor',
    });
    expect(console.error).toHaveBeenCalledWith(
      'Could not restore the live look; going to the Base Look.',
      expect.any(TypeError),
    );
  });

  it('starts empty when the documents fail too', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const before = liveSnapshot();
    const after = snapshotEngine();
    const layers = [...before.show.document.layers, before.show.document.layers[0]!];
    const broken = {
      ...before,
      show: { ...before.show, document: { ...before.show.document, layers } },
    };

    expect(after.engine.restore(broken)).toBe('empty');

    const { show, venue, playback } = after.engine.snapshot();
    expect(show).toEqual({ document: expect.objectContaining({ scenes: [] }), unsaved: false });
    expect(venue.unsaved).toBe(false);
    expect(playback).toMatchObject({ active: [], blackout: false, grandMaster: 1 });
  });
});
