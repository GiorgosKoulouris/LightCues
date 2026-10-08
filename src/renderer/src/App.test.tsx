import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineCommand, EngineEvent, MidiInputStatus } from '../../shared/protocol';
import type { Show } from '../../shared/show';
import { emptyPatch } from '../../shared/venue-patch';
import { App } from './App';
import { installFakeEngine, type FakeEngine } from './test-engine';
import { UiProvider } from './ui/UiProvider';

const SHOW: Show = {
  layers: [{ id: 'layer-1', name: 'Layer 1' }],
  scenes: [{ id: 'warm', name: 'Warm', tags: [], layer: 'layer-1', fadeIn: 0, rules: [] }],
  triggers: [],
  panelScenes: ['warm'],
};

const playback = (more: Partial<Extract<EngineEvent, { type: 'playback' }>> = {}): EngineEvent => ({
  type: 'playback',
  active: {},
  mode: 'monitor',
  grandMaster: 1,
  blackout: false,
  freeze: false,
  ...more,
});

const midi = (status: MidiInputStatus): EngineEvent => ({ type: 'midiInput', status });

function answer(command: EngineCommand): EngineEvent[] {
  switch (command.type) {
    case 'getShow':
      return [
        {
          type: 'show',
          show: SHOW,
          path: 'C:\\Shows\\Tour.lcshow',
          unsaved: true,
          canUndo: false,
          canRedo: false,
        },
      ];
    case 'getVenue':
      return [
        {
          type: 'venue',
          patch: emptyPatch({ width: 10, depth: 6 }),
          unsaved: false,
          canUndo: false,
          canRedo: false,
        },
      ];
    case 'getPlayback':
      return [playback()];
    case 'getTempo':
      return [{ type: 'tempo', bpm: 120, source: 'default' }];
    case 'listMidiInputs':
      return [midi({ state: 'none', ports: [] })];
    case 'listProfiles':
      return [{ type: 'profiles', entries: [] }];
    case 'listOutputs':
      return [{ type: 'outputs', outputs: [] }];
    default:
      return [];
  }
}

let engine: FakeEngine;
const dialogs = {
  chooseShowToOpen: vi.fn(async () => undefined),
  chooseShowToSave: vi.fn(async () => undefined),
  chooseVenueToOpen: vi.fn(async () => undefined),
  chooseVenueToSave: vi.fn(async () => undefined),
};

async function renderApp() {
  render(
    <UiProvider>
      <App />
    </UiProvider>,
  );
  await screen.findByRole('button', { name: /Warm/ });
}

const panelCommands = () =>
  engine.sent.filter((c) =>
    ['goScene', 'goBaseLook', 'setBlackout', 'setGrandMaster', 'tapTempo', 'setFreeze'].includes(
      c.type,
    ),
  );
const currentView = () => screen.getByRole('button', { current: 'page' });

beforeEach(() => {
  engine = installFakeEngine(answer);
  vi.stubGlobal('dialogs', dialogs);
  vi.stubGlobal('closeGuard', { setUnsaved: vi.fn(), onSaveBeforeClose: vi.fn(() => () => {}) });
  Object.values(dialogs).forEach((fn) => fn.mockClear());
});
afterEach(() => {
  // Unmounts while the fake engine is still there.
  cleanup();
  vi.unstubAllGlobals();
});

describe('App shortcuts', () => {
  it('switches view with Ctrl+1 to 4 without firing a Scene button', async () => {
    await renderApp();
    await userEvent.keyboard('{Control>}1{/Control}');
    expect(currentView()).toHaveTextContent('Show');
    await userEvent.keyboard('{Control>}3{/Control}');
    expect(currentView()).toHaveTextContent('Profile Library');
    await userEvent.keyboard('{Control>}2{/Control}');
    expect(currentView()).toHaveTextContent('Venue Patch');
    await userEvent.keyboard('{Control>}4{/Control}');
    expect(currentView()).toHaveTextContent('Perform');
    expect(panelCommands()).toEqual([]);
  });

  it('hides the Fallback Panel strip in Perform, and its keys still work', async () => {
    await renderApp();
    await userEvent.keyboard('{Control>}4{/Control}');
    expect(screen.queryByRole('region', { name: 'Fallback Panel' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Layer 1' })).toBeInTheDocument();
    await userEvent.keyboard('1b');
    expect(panelCommands()).toEqual([
      { type: 'goScene', sceneId: 'warm' },
      { type: 'setBlackout', on: true },
    ]);
    await userEvent.keyboard('{Control>}1{/Control}');
    expect(screen.getByRole('region', { name: 'Fallback Panel' })).toBeInTheDocument();
  });

  it('fires the Scene button on a bare digit without switching view', async () => {
    await renderApp();
    await userEvent.keyboard('1');
    expect(currentView()).toHaveTextContent('Venue Patch');
    expect(panelCommands()).toEqual([{ type: 'goScene', sceneId: 'warm' }]);
  });

  it("saves the current view's file with Ctrl+S and Ctrl+Shift+S, and not on a bare S", async () => {
    await renderApp();
    await userEvent.keyboard('s');
    expect(dialogs.chooseVenueToSave).not.toHaveBeenCalled();
    await userEvent.keyboard('{Control>}s{/Control}');
    expect(dialogs.chooseVenueToSave).toHaveBeenCalledTimes(1);
    expect(dialogs.chooseShowToSave).not.toHaveBeenCalled();

    await userEvent.keyboard('{Control>}1{/Control}');
    await userEvent.keyboard('{Control>}{Shift>}S{/Shift}{/Control}');
    expect(dialogs.chooseShowToSave).toHaveBeenCalledWith('C:\\Shows\\Tour.lcshow', undefined);
    expect(dialogs.chooseVenueToSave).toHaveBeenCalledTimes(1);
    expect(panelCommands()).toEqual([]);
  });

  it('opens with Ctrl+O, and Blackout stays on B', async () => {
    await renderApp();
    await userEvent.keyboard('{Control>}o{/Control}');
    expect(dialogs.chooseVenueToOpen).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Control>}b{/Control}');
    expect(panelCommands()).toEqual([]);
    await userEvent.keyboard('b');
    expect(panelCommands()).toEqual([{ type: 'setBlackout', on: true }]);
  });

  it('taps the Tempo with T', async () => {
    await renderApp();
    await userEvent.keyboard('t');
    expect(panelCommands()).toEqual([{ type: 'tapTempo' }]);
  });

  it('toggles Freeze with F', async () => {
    await renderApp();
    await userEvent.keyboard('f');
    engine.emit(playback({ freeze: true }));
    await userEvent.keyboard('f');
    expect(panelCommands()).toEqual([
      { type: 'setFreeze', on: true },
      { type: 'setFreeze', on: false },
    ]);
  });

  it('commits a field being typed in before Ctrl+S saves', async () => {
    await renderApp();
    await userEvent.keyboard('{Control>}1{/Control}');
    await userEvent.type(screen.getByRole('textbox', { name: 'Layer name' }), ' Front');
    await userEvent.keyboard('{Control>}s{/Control}');
    const types = engine.sent.map((c) => c.type);
    expect(types.indexOf('editShow')).toBeGreaterThan(-1);
    expect(types.indexOf('editShow')).toBeLessThan(types.indexOf('saveShow'));
  });

  it('labels a MIDI Input that failed to open as failed, not lost', async () => {
    await renderApp();
    engine.emit(midi({ state: 'failed', selected: 'nanoKEY', ports: [], error: 'busy' }));
    expect(screen.getByRole('alert')).toHaveTextContent('MIDI failed: nanoKEY');
  });

  it('runs no file command in the Profile Library', async () => {
    await renderApp();
    await userEvent.keyboard('{Control>}3{/Control}');
    await userEvent.keyboard('{Control>}s{/Control}{Control>}o{/Control}');
    expect(dialogs.chooseShowToSave).not.toHaveBeenCalled();
    expect(dialogs.chooseVenueToSave).not.toHaveBeenCalled();
    expect(dialogs.chooseVenueToOpen).not.toHaveBeenCalled();
  });
});

describe('App top bar and strip', () => {
  it('names the files and marks the unsaved one', async () => {
    await renderApp();
    const bar = screen.getByRole('banner');
    expect(bar).toHaveTextContent('Tour.lcshow');
    expect(bar).toHaveTextContent('Untitled');
    expect(screen.getAllByRole('img', { name: 'unsaved changes' })).toHaveLength(1);
  });

  it('shows Blind and Blackout from any view', async () => {
    await renderApp();
    await userEvent.keyboard('{Control>}3{/Control}');
    engine.emit(playback({ mode: 'blind', blackout: true }));
    expect(screen.getByRole('banner')).toHaveTextContent('Blind');
    expect(screen.getByRole('button', { name: /Blackout/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows the Tempo and where it comes from on the strip', async () => {
    await renderApp();
    const tap = screen.getByRole('button', { name: /Tap/ });
    expect(tap).toHaveTextContent('120 BPM');
    expect(tap).not.toHaveTextContent('Clock');
    engine.emit({ type: 'tempo', bpm: 127.6, source: 'clock' });
    expect(tap).toHaveTextContent('128 BPM');
    expect(tap).toHaveTextContent('Clock');
    engine.emit({ type: 'tempo', bpm: 127.6, source: 'held' });
    expect(tap).toHaveTextContent('Clock lost');
    engine.emit({ type: 'tempo', bpm: 140, source: 'tap' });
    expect(tap).toHaveTextContent('140 BPM');
    expect(tap).toHaveTextContent('Tapped');
    await userEvent.click(tap);
    expect(panelCommands()).toEqual([{ type: 'tapTempo' }]);
  });

  it('shows a lost MIDI Input as an alert in the top bar', async () => {
    await renderApp();
    engine.emit(midi({ state: 'lost', selected: 'nanoKEY', ports: [] }));
    expect(screen.getByRole('alert')).toHaveTextContent('MIDI lost: nanoKEY');
  });

  it('shows the engine as running once it replies to a ping', async () => {
    await renderApp();
    expect(screen.getByText('Engine starting…')).toBeInTheDocument();
    const ping = engine.sent.find((c) => c.type === 'ping');
    if (ping?.type !== 'ping') throw new Error('No ping sent');
    engine.emit({ type: 'pong', id: ping.id, uptimeMs: 1000 });
    expect(screen.getByText('Engine')).toBeInTheDocument();
  });
});
