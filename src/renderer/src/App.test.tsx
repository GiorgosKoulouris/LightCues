import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AppInfo,
  EngineCommand,
  EngineEvent,
  EngineRecoveryBridge,
  MidiInputStatus,
  RestoreResult,
  UpdateAvailable,
  UpdatesBridge,
} from '../../shared/protocol';
import { emptyShow, type Show } from '../../shared/show';
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
    case 'openVenue':
      return [{ type: 'venueDone', requestId: command.requestId, errors: [] }];
    case 'openShow':
      return [{ type: 'showDone', requestId: command.requestId, errors: [] }];
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
  openExample: vi.fn(async () => EXAMPLE),
};
const EXAMPLE = {
  venue: 'C:/LightCues/examples/demo.lcvenue',
  show: 'C:/LightCues/examples/demo.lcshow',
};

const RELEASE: UpdateAvailable = {
  version: '0.2.0',
  url: 'https://github.com/GiorgosKoulouris/LightCues/releases/tag/v0.2.0',
};
const APP_INFO: AppInfo = {
  appVersion: '0.2.0',
  electronVersion: '44.7.0',
  windowsVersion: '10.0.22631',
  logFolder: 'C:\\Users\\sam\\AppData\\Roaming\\LightCues\\logs',
};

let updates: { [K in keyof UpdatesBridge]: ReturnType<typeof vi.fn<UpdatesBridge[K]>> };

// A fake `window.engineRecovery`: a test tells it the engine restarted or is
// down, as main does.
function fakeRecovery() {
  const restarted = new Set<(result: RestoreResult) => void>();
  const down = new Set<() => void>();
  const bridge = {
    onRestarted: (listener: (result: RestoreResult) => void) => {
      restarted.add(listener);
      return () => void restarted.delete(listener);
    },
    onDown: (listener: () => void) => {
      down.add(listener);
      return () => void down.delete(listener);
    },
    isDown: vi.fn(async () => false),
    saveFromSnapshot: vi.fn<EngineRecoveryBridge['saveFromSnapshot']>(async () => undefined),
  };
  return {
    bridge,
    restart: (result: RestoreResult) => act(() => restarted.forEach((l) => l(result))),
    down: () => act(() => down.forEach((l) => l())),
  };
}
let recovery: ReturnType<typeof fakeRecovery>;

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
  updates = {
    available: vi.fn(async () => undefined),
    enabled: vi.fn(async () => true),
    setEnabled: vi.fn(),
    checkNow: vi.fn(async () => ({ state: 'upToDate' as const })),
    openReleasePage: vi.fn(),
  };
  vi.stubGlobal('updates', updates);
  vi.stubGlobal('diagnostics', { appInfo: vi.fn(async () => APP_INFO) });
  recovery = fakeRecovery();
  vi.stubGlobal('engineRecovery', recovery.bridge);
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

describe('App update notice', () => {
  const notice = () => screen.queryByRole('status', { name: 'Update available' });

  it('shows a newer release and opens its page', async () => {
    updates.available.mockResolvedValue(RELEASE);
    await renderApp();
    expect(await screen.findByText('LightCues 0.2.0 is available')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open release page' }));
    expect(updates.openReleasePage).toHaveBeenCalledWith(RELEASE.url);
  });

  it('shows nothing without a newer release', async () => {
    await renderApp();
    expect(notice()).toBeNull();
  });

  it('never shows in Perform, and shows again on leaving it', async () => {
    updates.available.mockResolvedValue(RELEASE);
    await renderApp();
    await screen.findByText('LightCues 0.2.0 is available');
    await userEvent.keyboard('{Control>}4{/Control}');
    expect(notice()).toBeNull();
    await userEvent.keyboard('{Control>}1{/Control}');
    expect(notice()).toBeInTheDocument();
  });

  it('shows the startup setting, and saves it', async () => {
    await renderApp();
    const setting = await screen.findByRole('checkbox', { name: 'Check on startup' });
    expect(setting).toBeChecked();
    await userEvent.click(setting);
    expect(updates.setEnabled).toHaveBeenCalledWith(false);
    expect(setting).not.toBeChecked();
  });

  it('shows the startup setting off when it was turned off', async () => {
    updates.enabled.mockResolvedValue(false);
    await renderApp();
    expect(await screen.findByRole('checkbox', { name: 'Check on startup' })).not.toBeChecked();
  });

  it('checks on request and shows a newer release', async () => {
    updates.checkNow.mockResolvedValue({ state: 'available', release: RELEASE });
    await renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
    expect(updates.checkNow).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('LightCues 0.2.0 is available')).toBeInTheDocument();
  });

  it('says when the app is up to date', async () => {
    updates.checkNow.mockResolvedValue({ state: 'upToDate' });
    await renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
    expect(await screen.findByText('LightCues is up to date')).toBeInTheDocument();
  });

  it('says when the check failed', async () => {
    updates.checkNow.mockResolvedValue({ state: 'failed' });
    await renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
    expect(await screen.findByText('Could not check for updates')).toBeInTheDocument();
  });
});

describe('App engine recovery', () => {
  it.each<[RestoreResult, string]>([
    ['restored', 'Engine restarted. Output resumed.'],
    ['baseLook', 'Engine restarted in Base Look.'],
    ['empty', 'Engine restarted without the open Show and Venue Patch.'],
  ])('says how a restart went: %s', async (result, message) => {
    await renderApp();
    recovery.restart(result);
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('shows the engine down for good, and saves the documents from the snapshot', async () => {
    recovery.bridge.saveFromSnapshot.mockResolvedValue('C:/gigs/rescued.lcshow');
    await renderApp();
    expect(screen.queryByRole('alert')).toBeNull();

    recovery.down();
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(
      'The engine keeps crashing. Save your work and restart LightCues.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save Show as…' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Venue Patch as…' }));

    expect(recovery.bridge.saveFromSnapshot.mock.calls).toEqual([['show'], ['venue']]);
    expect(await screen.findAllByText('Saved C:/gigs/rescued.lcshow')).not.toHaveLength(0);
  });

  it('shows the engine down after a reload', async () => {
    recovery.bridge.isDown.mockResolvedValue(true);
    await renderApp();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('says when a save from the snapshot fails', async () => {
    recovery.bridge.isDown.mockResolvedValue(true);
    recovery.bridge.saveFromSnapshot.mockRejectedValue(new Error('EACCES'));
    await renderApp();
    await userEvent.click(await screen.findByRole('button', { name: 'Save Show as…' }));
    expect(await screen.findByText('Could not save the Show: EACCES')).toBeInTheDocument();
  });
});

describe('App example', () => {
  const opens = () => engine.sent.filter((c) => c.type === 'openVenue' || c.type === 'openShow');
  const emptyState = { unsaved: false, canUndo: false, canRedo: false };

  it('offers the example while nothing is open and opens both files as new', async () => {
    await renderApp();
    expect(screen.queryByText('New here?')).toBeNull();
    engine.emit({ type: 'show', show: emptyShow(), ...emptyState });

    const hint = screen.getByRole('complementary', { name: 'Example' });
    await userEvent.click(within(hint).getByRole('button', { name: 'Open example' }));

    expect(dialogs.openExample).toHaveBeenCalledTimes(1);
    expect(opens()).toEqual([
      { type: 'openVenue', requestId: expect.any(Number), path: EXAMPLE.venue, asNew: true },
      { type: 'openShow', requestId: expect.any(Number), path: EXAMPLE.show, asNew: true },
    ]);
  });

  it('asks before the example replaces unsaved changes', async () => {
    await renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'Open example' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('The Show has unsaved changes.');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(dialogs.openExample).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Open example' }));
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(dialogs.openExample).toHaveBeenCalledTimes(1);
    expect(opens()).toHaveLength(2);
  });
});

describe('App diagnostics', () => {
  it('copies the diagnostics, without the open file paths, and says so', async () => {
    const user = userEvent.setup();
    await renderApp();
    engine.emit({
      type: 'outputs',
      outputs: [{ id: 'EN123456', name: 'DMX USB PRO', state: 'sending' }],
    });
    await user.click(screen.getByRole('button', { name: 'Copy diagnostics' }));

    expect(await screen.findByText('Diagnostics copied')).toBeInTheDocument();
    const text = await navigator.clipboard.readText();
    expect(text).toContain('App version: 0.2.0\n');
    expect(text).toContain(`Log folder: ${APP_INFO.logFolder}\n`);
    expect(text).toContain('  DMX USB PRO (EN123456): sending\n');
    expect(text).toContain('MIDI Input: none\n');
    expect(text).toContain('Tempo: 120 BPM, default\n');
    expect(text).not.toContain('Tour.lcshow');
  });

  it('is not in Perform', async () => {
    await renderApp();
    await userEvent.keyboard('{Control>}4{/Control}');
    expect(screen.queryByRole('button', { name: 'Copy diagnostics' })).toBeNull();
  });
});
