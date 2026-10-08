import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineCommand, EngineEvent, ShowEdit } from '../../../shared/protocol';
import type { Scene, Show } from '../../../shared/show';
import { emptyPatch } from '../../../shared/venue-patch';
import { installFakeEngine, type FakeEngine } from '../test-engine';
import { stubListLayout } from '../test-layout';
import { UiProvider } from '../ui/UiProvider';
import { ShowView } from './ShowView';

const scene = (id: string, name: string, more: Partial<Scene> = {}): Scene => ({
  id,
  name,
  tags: [],
  layer: 'layer-1',
  fadeIn: 0,
  rules: [],
  ...more,
});

const SHOW: Show = {
  layers: [
    { id: 'layer-1', name: 'Base' },
    { id: 'layer-2', name: 'Accents' },
  ],
  scenes: [
    scene('warm', 'Warm', {
      tags: ['verse'],
      rules: [
        { target: {}, intensity: 0.5 },
        { target: { roles: ['Strobe'] }, intensity: 1 },
      ],
    }),
    scene('blue', 'Blue', { tags: ['chorus'] }),
    scene('hit', 'Strobe hit', { tags: ['chorus'], layer: 'layer-2' }),
  ],
  triggers: [{ channel: 1, note: 60, scene: 'warm', mode: 'go' }],
  baseLook: 'warm',
  panelScenes: ['warm', 'blue'],
};

let engine: FakeEngine;
let show: Show;
let unsaved: boolean;
// Errors the engine answers the next change with.
let rejectWith: string[];
const dialogs = {
  chooseShowToOpen: vi.fn(async (): Promise<string | undefined> => undefined),
  chooseShowToSave: vi.fn(async (): Promise<string | undefined> => 'C:\\Shows\\Tour.lcshow'),
};

function answer(command: EngineCommand): EngineEvent[] {
  const showEvent = (): EngineEvent => ({
    type: 'show',
    show,
    unsaved,
    canUndo: false,
    canRedo: false,
  });
  switch (command.type) {
    case 'getShow':
      return [showEvent()];
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
      return [
        {
          type: 'playback',
          active: { 'layer-2': 'hit' },
          mode: 'monitor',
          grandMaster: 1,
          blackout: false,
          freeze: false,
        },
      ];
    case 'listMidiInputs':
      return [{ type: 'midiInput', status: { state: 'none', ports: ['nanoKEY'] } }];
    case 'editShow': {
      const errors = rejectWith;
      rejectWith = [];
      if (errors.length === 0) {
        show = applied(show, command.edit);
        unsaved = true;
      }
      const done: EngineEvent = { type: 'showDone', requestId: command.requestId, errors };
      return errors.length > 0 ? [done] : [showEvent(), done];
    }
    case 'saveShow': {
      const errors = rejectWith;
      rejectWith = [];
      return [{ type: 'showDone', requestId: command.requestId, errors }];
    }
    default:
      return [];
  }
}

// Enough of the engine's edits for these tests.
function applied(current: Show, edit: ShowEdit): Show {
  switch (edit.type) {
    case 'putScene':
      return {
        ...current,
        scenes: current.scenes.some((s) => s.id === edit.scene.id)
          ? current.scenes.map((s) => (s.id === edit.scene.id ? edit.scene : s))
          : [...current.scenes, edit.scene],
      };
    case 'removeScene':
      return { ...current, scenes: current.scenes.filter((s) => s.id !== edit.id) };
    case 'setBaseLook':
      return { ...current, baseLook: edit.sceneId };
    case 'setPanelScenes':
      return { ...current, panelScenes: edit.sceneIds };
    default:
      return current;
  }
}

const edits = () =>
  engine.sent.flatMap((c) => (c.type === 'editShow' ? [c.edit] : ([] as ShowEdit[])));
const sentOf = (type: EngineCommand['type']) => engine.sent.filter((c) => c.type === type);

async function renderView() {
  render(
    <UiProvider>
      <ShowView active />
    </UiProvider>,
  );
  return screen.findByRole('listbox', { name: 'Scenes' });
}

const sceneList = () => within(screen.getByRole('listbox', { name: 'Scenes' }));
const optionNames = () =>
  sceneList()
    .getAllByRole('option')
    .map((option) => within(option).getByTestId('name').textContent);
const selectedName = () =>
  within(sceneList().getByRole('option', { selected: true })).getByTestId('name').textContent;

beforeEach(() => {
  show = SHOW;
  unsaved = false;
  rejectWith = [];
  engine = installFakeEngine(answer);
  vi.stubGlobal('dialogs', dialogs);
  vi.stubGlobal('closeGuard', { setUnsaved: vi.fn(), onSaveBeforeClose: vi.fn(() => () => {}) });
  Object.values(dialogs).forEach((fn) => fn.mockClear());
  stubListLayout();
});
afterEach(() => {
  // Unmounts while the fake engine is still there.
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Scene list', () => {
  it('selects Scenes with the arrow keys and opens the selected one in the editor', async () => {
    const list = await renderView();
    act(() => list.focus());
    await userEvent.keyboard('{ArrowDown}');
    expect(selectedName()).toBe('Warm');
    await userEvent.keyboard('{ArrowDown}');
    expect(selectedName()).toBe('Blue');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Blue');
  });

  it('marks the active Scene and shows each Scene’s Layer', async () => {
    await renderView();
    const hit = screen.getByRole('option', { name: /Strobe hit/ });
    expect(within(hit).getByRole('img', { name: 'active' })).toBeInTheDocument();
    expect(hit).toHaveTextContent('Accents');
    const warm = screen.getByRole('option', { name: /Warm/ });
    expect(within(warm).queryByRole('img', { name: 'active' })).not.toBeInTheDocument();
  });

  it('goes to a Scene from its Go button, and from Enter on the list', async () => {
    const list = await renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Go Blue' }));
    expect(sentOf('goScene')).toEqual([{ type: 'goScene', sceneId: 'blue' }]);
    act(() => list.focus());
    await userEvent.keyboard('{ArrowUp}{Enter}');
    expect(sentOf('goScene')).toHaveLength(2);
    expect(sentOf('goScene')[1]).toEqual({ type: 'goScene', sceneId: 'warm' });
  });

  it('removes the selected Scene on Del, tells what went with it, and selects the next one', async () => {
    const list = await renderView();
    act(() => list.focus());
    await userEvent.keyboard('{ArrowDown}{Delete}');
    expect(edits()).toEqual([{ type: 'removeScene', id: 'warm' }]);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Removed Warm, its 1 Trigger, the Base Look and its Fallback Panel button',
    );
    await screen.findByRole('option', { name: /Blue/, selected: true });
  });

  it('focuses the search on Ctrl+F and filters by name', async () => {
    await renderView();
    await userEvent.keyboard('{Control>}f{/Control}');
    const search = screen.getByRole('searchbox', { name: 'Search Scenes' });
    expect(search).toHaveFocus();
    await userEvent.keyboard('bl');
    expect(optionNames()).toEqual(['Blue']);
  });

  it('filters by a tag chip, and a new Scene gets that tag', async () => {
    await renderView();
    await userEvent.click(screen.getByRole('button', { name: 'chorus' }));
    expect(optionNames()).toEqual(['Blue', 'Strobe hit']);
    await userEvent.click(screen.getByRole('button', { name: 'New Scene' }));
    const [put] = edits();
    expect(put).toMatchObject({ type: 'putScene', scene: { tags: ['chorus'] } });
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(optionNames()).toHaveLength(4);
  });
});

describe('Scene editor', () => {
  async function selectWarm() {
    await renderView();
    await userEvent.click(screen.getByRole('option', { name: /Warm/ }));
  }

  it('commits a valid fade-in and shows an error for an invalid one', async () => {
    await selectWarm();
    const fadeIn = screen.getByRole('textbox', { name: 'Fade-in (s)' });
    await userEvent.clear(fadeIn);
    await userEvent.type(fadeIn, '2.5');
    expect(edits().at(-1)).toMatchObject({ type: 'putScene', scene: { fadeIn: 2.5 } });
    const count = edits().length;
    await userEvent.clear(fadeIn);
    await userEvent.type(fadeIn, '-1');
    expect(fadeIn).toHaveAttribute('aria-invalid', 'true');
    expect(fadeIn).toHaveAccessibleDescription('Must be at least 0');
    expect(
      edits()
        .slice(count)
        .some((e) => e.type === 'putScene' && e.scene.fadeIn < 0),
    ).toBe(false);
  });

  it('goes to the Scene from the editor', async () => {
    await selectWarm();
    await userEvent.click(within(editor()).getByRole('button', { name: 'Go' }));
    expect(sentOf('goScene')).toEqual([{ type: 'goScene', sceneId: 'warm' }]);
  });

  it('reorders Rules with the keyboard', async () => {
    await selectWarm();
    screen.getByRole('button', { name: 'Move Rule 1' }).focus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard(' ');
    await act(async () => {});
    const put = edits().at(-1);
    if (put?.type !== 'putScene') throw new Error('No Scene put');
    expect(put.scene.rules.map((r) => r.intensity)).toEqual([1, 0.5]);
    // Focus follows the moved Rule, so the next move takes the same Rule.
    await screen.findByRole('button', { name: 'Move Rule 2' });
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Move Rule 2' })).toHaveFocus();
  });

  it('removes a Rule at once', async () => {
    await selectWarm();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Rule 2' }));
    expect(edits().at(-1)).toMatchObject({
      type: 'putScene',
      scene: { rules: [{ target: {}, intensity: 0.5 }] },
    });
  });

  it("sets a Rule's Direction, and leaves it to others when not set", async () => {
    await selectWarm();
    const direction = screen.getAllByLabelText('Direction')[0]!;
    expect(direction).toHaveValue('');
    await userEvent.selectOptions(direction, 'Audience');
    expect(edits().at(-1)).toMatchObject({
      type: 'putScene',
      scene: { rules: [{ target: {}, intensity: 0.5, direction: 'Audience' }, {}] },
    });
    await userEvent.selectOptions(direction, 'Not set');
    const put = edits().at(-1);
    if (put?.type !== 'putScene') throw new Error('No Scene put');
    expect(put.scene.rules[0]).toEqual({ target: {}, intensity: 0.5 });
  });

  it("sets a Rule's movement Effect: shape, size with quick picks, length and Spread", async () => {
    await selectWarm();
    const rule = () => {
      const put = edits().at(-1);
      if (put?.type !== 'putScene') throw new Error('No Scene put');
      return put.scene.rules[0];
    };
    const effect = screen.getAllByLabelText('Movement Effect')[0]!;
    expect(effect).toHaveValue('');
    expect(screen.queryByRole('textbox', { name: 'Size (°)' })).toBeNull();

    await userEvent.selectOptions(effect, 'Circle');
    expect(rule()).toEqual({
      target: {},
      intensity: 0.5,
      effect: { shape: 'Circle', size: 12, length: 4, spread: 'In sync' },
    });

    const sizes = within(screen.getByRole('group', { name: 'Quick sizes' }));
    expect(sizes.getByRole('button', { name: 'Medium 12°' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(sizes.getByRole('button', { name: 'Large 25°' }));
    expect(rule()?.effect?.size).toBe(25);
    const size = screen.getByRole('textbox', { name: 'Size (°)' });
    await userEvent.clear(size);
    await userEvent.type(size, '7.5');
    expect(rule()?.effect?.size).toBe(7.5);

    await userEvent.selectOptions(screen.getByLabelText('Length (beats)'), '16');
    expect(rule()?.effect?.length).toBe(16);
    await userEvent.selectOptions(screen.getByLabelText('Spread'), 'Mirrored');
    expect(rule()?.effect).toEqual({ shape: 'Circle', size: 7.5, length: 16, spread: 'Mirrored' });

    // A new shape keeps the rest.
    await userEvent.selectOptions(effect, 'Ballyhoo');
    expect(rule()?.effect).toEqual({
      shape: 'Ballyhoo',
      size: 7.5,
      length: 16,
      spread: 'Mirrored',
    });
    await userEvent.selectOptions(effect, 'Not set');
    expect(rule()).toEqual({ target: {}, intensity: 0.5 });
  });

  it('shows an engine error as a toast', async () => {
    await selectWarm();
    rejectWith = ['Scene "Warm" has no Rules'];
    await userEvent.click(screen.getByRole('button', { name: 'Add Rule' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Scene "Warm" has no Rules');
  });
});

const editor = () => screen.getByRole('region', { name: 'Scene editor' });

describe('Layer stack', () => {
  it('lists each Layer with its active Scene, and clears it', async () => {
    await renderView();
    const layers = screen.getByRole('list', { name: 'Layers' });
    const accents = within(layers).getAllByRole('listitem')[1]!;
    expect(accents).toHaveTextContent('Strobe hit');
    await userEvent.click(within(accents).getByRole('button', { name: 'Clear Accents' }));
    expect(sentOf('clearLayer')).toEqual([{ type: 'clearLayer', layerId: 'layer-2' }]);
  });

  it('removes a Layer and tells which Scenes went with it', async () => {
    await renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Layer Accents' }));
    expect(edits()).toEqual([{ type: 'removeLayer', id: 'layer-2' }]);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Removed Accents and its 1 Scene: Strobe hit',
    );
  });
});

describe('Show settings', () => {
  async function openSettings() {
    await renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Show settings' }));
    return screen.findByRole('dialog', { name: 'Show settings' });
  }

  it('sets the Base Look', async () => {
    const settings = await openSettings();
    await userEvent.selectOptions(within(settings).getByLabelText('Base Look'), 'Blue');
    expect(edits()).toEqual([{ type: 'setBaseLook', sceneId: 'blue' }]);
  });

  it('sets the Default Direction, Down unless changed', async () => {
    const settings = await openSettings();
    const direction = within(settings).getByLabelText('Default Direction');
    expect(direction).toHaveValue('Down');
    await userEvent.selectOptions(direction, 'Centre');
    expect(edits()).toEqual([{ type: 'setDefaultDirection', direction: 'Centre' }]);
  });

  it('orders the Fallback Panel Scenes by drag, and adds and removes them', async () => {
    const settings = await openSettings();
    within(settings).getByRole('button', { name: 'Move Blue' }).focus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard(' ');
    await act(async () => {});
    expect(edits().at(-1)).toEqual({ type: 'setPanelScenes', sceneIds: ['blue', 'warm'] });

    await userEvent.selectOptions(within(settings).getByLabelText('Add a Scene'), 'Strobe hit');
    expect(edits().at(-1)).toEqual({ type: 'setPanelScenes', sceneIds: ['blue', 'warm', 'hit'] });

    await userEvent.click(
      within(settings).getByRole('button', { name: 'Remove Warm from the panel' }),
    );
    expect(edits().at(-1)).toEqual({ type: 'setPanelScenes', sceneIds: ['blue', 'hit'] });
  });
});

describe('Show file', () => {
  it('shows a brief toast after saving, and the errors when it fails', async () => {
    await renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Show saved');
    rejectWith = ['Disk full'];
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Disk full');
  });

  it('asks before New discards unsaved changes', async () => {
    unsaved = true;
    await renderView();
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('unsaved changes');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(sentOf('newShow')).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(sentOf('newShow')).toHaveLength(1);
  });
});

describe('Triggers', () => {
  it('lists the Triggers and selects the MIDI Input', async () => {
    await renderView();
    await userEvent.click(screen.getByRole('tab', { name: 'Triggers' }));
    const table = screen.getByRole('table', { name: 'Triggers' });
    expect(table).toHaveTextContent('C4');
    expect(table).toHaveTextContent('Warm');
    await userEvent.selectOptions(screen.getByLabelText('MIDI Input'), 'nanoKEY');
    expect(sentOf('selectMidiInput')).toEqual([{ type: 'selectMidiInput', name: 'nanoKEY' }]);
  });
});
