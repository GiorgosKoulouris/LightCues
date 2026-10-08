import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FixtureProfile } from '../../../shared/fixture-profile';
import type { EngineCommand, EngineEvent, VenueEdit } from '../../../shared/protocol';
import {
  addUniverse,
  moveFixture,
  putFixture,
  putFixtures,
  putUniverse,
  removeFixtures,
  removeUniverse,
  setStage,
  type PatchedFixture,
  type PatchResult,
  type VenuePatch,
} from '../../../shared/venue-patch';
import { installFakeEngine, type FakeEngine } from '../test-engine';
import { UiProvider } from '../ui/UiProvider';
import { VenuePatchView } from './VenuePatchView';

const channels = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    kind: 'control' as const,
    name: `Channel ${i + 1}`,
    defaultValue: 0,
    ranges: [],
  }));

const par: FixtureProfile = {
  id: 'acme/par',
  manufacturer: 'Acme',
  model: 'Par',
  defaultRole: 'Wash',
  modes: [
    { name: '3ch', channels: channels(3) },
    { name: '6ch', channels: channels(6) },
  ],
};

// Named "Par 1", with id "par-1".
const fixture = (name: string, more: Partial<PatchedFixture> = {}): PatchedFixture => ({
  id: name.toLowerCase().replace(' ', '-'),
  name,
  profileId: 'acme/par',
  mode: '3ch',
  universe: 1,
  address: 1,
  x: 0,
  y: 1,
  height: 0,
  ...more,
});

// Par 1–8 in Universe 1 at 1, 4, 7, …; Spot in Universe 2.
const PATCH: VenuePatch = {
  stage: { width: 12, depth: 9 },
  universes: [{ number: 1 }, { number: 2 }],
  profiles: [par],
  fixtures: [
    ...Array.from({ length: 8 }, (_, i) =>
      fixture(`Par ${i + 1}`, { address: 1 + 3 * i, x: -5 + i }),
    ),
    fixture('Spot', { universe: 2, y: 8 }),
  ],
};

let engine: FakeEngine;
let patch: VenuePatch;
const dialogs = {
  chooseVenueToOpen: vi.fn(async (): Promise<string | undefined> => undefined),
  chooseVenueToSave: vi.fn(async (): Promise<string | undefined> => undefined),
};

function answer(command: EngineCommand): EngineEvent[] {
  const venueEvent = (): EngineEvent => ({
    type: 'venue',
    patch,
    unsaved: false,
    canUndo: false,
    canRedo: false,
  });
  switch (command.type) {
    case 'getVenue':
      return [venueEvent()];
    case 'listProfiles':
      return [{ type: 'profiles', entries: [{ profile: par, handEdited: false }] }];
    case 'editVenue': {
      const result = applied(patch, command.edit);
      if ('patch' in result) patch = result.patch;
      const errors = 'errors' in result ? result.errors : [];
      const done: EngineEvent = { type: 'venueDone', requestId: command.requestId, errors };
      return errors.length > 0 ? [done] : [venueEvent(), done];
    }
    default:
      return [];
  }
}

function applied(current: VenuePatch, edit: VenueEdit): PatchResult {
  switch (edit.type) {
    case 'setStage':
      return setStage(current, edit.stage);
    case 'addUniverse':
      return addUniverse(current, edit.universe);
    case 'putUniverse':
      return putUniverse(current, edit.universe);
    case 'removeUniverse':
      return { patch: removeUniverse(current, edit.number) };
    case 'putFixture':
      return putFixture(current, edit.fixture, par);
    case 'putFixtures':
      return putFixtures(current, edit.fixtures);
    case 'moveFixture':
      return moveFixture(current, edit.id, edit.position);
    case 'removeFixtures':
      return { patch: removeFixtures(current, edit.ids) };
  }
}

const edits = () =>
  engine.sent.flatMap((c) => (c.type === 'editVenue' ? [c.edit] : ([] as VenueEdit[])));

async function renderView() {
  render(
    <UiProvider>
      <VenuePatchView active />
    </UiProvider>,
  );
  return screen.findByRole('listbox', { name: 'Fixtures' });
}

const nameOf = (option: HTMLElement) => within(option).getByTestId('name').textContent;
const listOptions = (filter: { selected?: boolean } = {}) =>
  within(screen.getByRole('listbox', { name: 'Fixtures' })).queryAllByRole('option', filter);
const findOption = (name: string) => listOptions().find((o) => nameOf(o) === name);
const option = (name: string) => {
  const found = findOption(name);
  if (!found) throw new Error(`No option ${name}`);
  return found;
};
const selectedNames = () => listOptions({ selected: true }).map(nameOf);
const inspector = () => within(screen.getByRole('region', { name: 'Fixture inspector' }));

beforeEach(() => {
  patch = PATCH;
  engine = installFakeEngine(answer);
  vi.stubGlobal('dialogs', dialogs);
  vi.stubGlobal('closeGuard', { setUnsaved: vi.fn(), onSaveBeforeClose: vi.fn(() => () => {}) });
});
afterEach(() => {
  // Unmounts while the fake engine is still there.
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Fixture multi-select', () => {
  it('selects a range with Shift-click and bulk-changes the Role of 8 Fixtures in one edit', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Par 1'));
    await user.keyboard('{Shift>}');
    await user.click(option('Par 8'));
    await user.keyboard('{/Shift}');

    expect(selectedNames()).toHaveLength(8);
    expect(inspector().getByRole('heading')).toHaveTextContent('8 Fixtures');

    await user.selectOptions(inspector().getByRole('combobox', { name: 'Role' }), 'Strobe');

    expect(edits()).toHaveLength(1);
    const [edit] = edits();
    expect(edit?.type === 'putFixtures' && edit.fixtures.map((f) => f.role)).toEqual(
      Array(8).fill('Strobe'),
    );
    expect(option('Par 5')).toHaveTextContent('Strobe');
  });

  it('toggles Fixtures with Ctrl-click in the list and on the plan', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Par 2'));
    await user.keyboard('{Control>}');
    await user.click(option('Spot'));
    await user.keyboard('{/Control}');
    expect(selectedNames()).toEqual(['Par 2', 'Spot']);

    fireEvent.pointerDown(screen.getByTestId('plan-par-4'), { ctrlKey: true });
    expect(selectedNames()).toEqual(['Par 2', 'Par 4', 'Spot']);
    fireEvent.pointerDown(screen.getByTestId('plan-par-2'), { ctrlKey: true });
    expect(selectedNames()).toEqual(['Par 4', 'Spot']);
  });

  it('grows a range with Shift+Arrow in the list', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Par 2'));
    await user.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}');
    expect(selectedNames()).toEqual(['Par 2', 'Par 3', 'Par 4']);
  });

  it('shows a field the selected Fixtures differ in as Mixed', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Par 1'));
    await user.keyboard('{Control>}');
    await user.click(option('Spot'));
    await user.keyboard('{/Control}');

    const universe = inspector().getByRole('combobox', { name: 'Universe' });
    expect(universe).toHaveDisplayValue('Mixed');
    expect(inspector().getByRole('combobox', { name: 'Role' })).toHaveDisplayValue(
      'Profile default',
    );
    expect(inspector().queryByRole('textbox', { name: 'Address' })).not.toBeInTheDocument();
  });

  it('shows inline when a bulk change does not fit, sending nothing', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Par 1'));
    await user.keyboard('{Shift>}');
    await user.click(option('Par 2'));
    await user.keyboard('{/Shift}');

    // Par 1 would overlap Spot at 2.1.
    const universe = inspector().getByRole('combobox', { name: 'Universe' });
    await user.selectOptions(universe, '2');

    expect(universe).toHaveAttribute('aria-invalid', 'true');
    expect(universe).toHaveAccessibleDescription(/"Spot".*overlaps|overlaps.*"Spot"/);
    expect(universe).toHaveDisplayValue('1');
    expect(edits()).toEqual([]);

    await user.selectOptions(inspector().getByRole('combobox', { name: 'Role' }), 'Strobe');
    expect(universe).toHaveAttribute('aria-invalid', 'false');
  });

  it('selects a range on the plan across Fixtures the search hides', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.type(screen.getByRole('searchbox', { name: 'Search Fixtures' }), 'spot');
    await user.click(option('Spot'));
    fireEvent.pointerDown(screen.getByTestId('plan-par-7'), { shiftKey: true });
    await user.clear(screen.getByRole('searchbox', { name: 'Search Fixtures' }));
    expect(selectedNames()).toEqual(['Par 7', 'Par 8', 'Spot']);
  });
});

describe('Fixture inspector', () => {
  it('shows an address clash inline without committing it, and reverts on Esc', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Par 1'));
    const address = inspector().getByRole('textbox', { name: 'Address' });

    await user.clear(address);
    await user.type(address, '5');

    expect(address).toHaveAttribute('aria-invalid', 'true');
    expect(inspector().getByText('Overlaps Par 2 (1.4–1.6)')).toBeInTheDocument();
    expect(edits()).toEqual([]);

    await user.keyboard('{Escape}');
    expect(address).toHaveValue('1');
    expect(address).toHaveAttribute('aria-invalid', 'false');
  });

  it('keeps the inspector drawer open when Esc reverts an invalid field', async () => {
    await renderView();
    const user = userEvent.setup();
    const toggle = screen.getByRole('button', { name: 'Show inspector' });
    await user.click(toggle);
    await user.click(option('Par 1'));
    const address = inspector().getByRole('textbox', { name: 'Address' });
    await user.clear(address);
    await user.keyboard('{Escape}');
    expect(address).toHaveValue('1');
    expect(screen.getByRole('button', { name: 'Hide inspector' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Show inspector' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('shows inline when a new mode would overlap the next Fixture, sending nothing', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Par 1'));
    const mode = inspector().getByRole('combobox', { name: 'Mode' });

    await user.selectOptions(mode, '6ch');

    expect(mode).toHaveAttribute('aria-invalid', 'true');
    expect(mode).toHaveAccessibleDescription(/"Par 2".*overlaps|overlaps.*"Par 2"/);
    expect(mode).toHaveDisplayValue('3ch (3 ch)');
    expect(edits()).toEqual([]);
  });

  it('commits a free address as soon as it is typed', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Par 8'));
    const address = inspector().getByRole('textbox', { name: 'Address' });

    await user.clear(address);
    await user.type(address, '100');

    expect(edits().at(-1)).toEqual({
      type: 'putFixtures',
      fixtures: [{ ...PATCH.fixtures[7], address: 100 }],
    });
    expect(option('Par 8')).toHaveTextContent('1.100');
  });

  it('rejects an address out of range or running past channel 512', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Par 8'));
    const address = inspector().getByRole('textbox', { name: 'Address' });

    // Pasted, so no valid prefix such as 51 commits on the way.
    await user.clear(address);
    await user.paste('511');
    expect(inspector().getByText('Runs past channel 512')).toBeInTheDocument();
    await user.type(address, '0');
    expect(inspector().getByText('Must be 1–512')).toBeInTheDocument();
    expect(edits()).toEqual([]);
  });
});

describe('Fixture list', () => {
  it('removes the selected Fixtures on Del, naming them', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Par 1'));
    await user.keyboard('{Shift>}');
    await user.click(option('Par 3'));
    await user.keyboard('{/Shift}{Delete}');

    expect(edits()).toEqual([{ type: 'removeFixtures', ids: ['par-1', 'par-2', 'par-3'] }]);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Removed 3 Fixtures: Par 1, Par 2, Par 3',
    );
    expect(findOption('Par 1')).toBeUndefined();
    expect(selectedNames()).toEqual([]);
  });

  it('groups by Universe or by Zone', async () => {
    await renderView();
    expect(screen.getByRole('group', { name: 'Universe 2' })).toHaveTextContent('Spot');

    await userEvent.click(screen.getByRole('button', { name: 'Zone' }));
    expect(screen.getByRole('group', { name: 'Upstage Centre Floor' })).toHaveTextContent('Spot');
  });

  it('searches on Ctrl+F', async () => {
    await renderView();
    await userEvent.keyboard('{Control>}f{/Control}');
    const search = screen.getByRole('searchbox', { name: 'Search Fixtures' });
    expect(search).toHaveFocus();
    await userEvent.keyboard('spot');
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('adds a Fixture from the dialog at the next free address and selects it', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add Fixture' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add Fixture' }));

    expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Par 10');
    const address = dialog.getByRole('textbox', { name: 'Address' });
    expect(address).toHaveValue('25');

    await user.selectOptions(dialog.getByRole('combobox', { name: 'Mode' }), '6ch');
    await user.clear(address);
    await user.type(address, '20');
    expect(dialog.getByText('Overlaps Par 7 (1.19–1.21)')).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Add' })).toBeDisabled();

    await user.clear(address);
    await user.type(address, '30');
    await user.click(dialog.getByRole('button', { name: 'Add' }));

    expect(edits()).toEqual([
      {
        type: 'putFixture',
        fixture: expect.objectContaining({ name: 'Par 10', mode: '6ch', universe: 1, address: 30 }),
      },
    ]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(selectedNames()).toEqual(['Par 10']);
  });
});

describe('Rig setup', () => {
  async function openRig() {
    await renderView();
    await userEvent.click(screen.getByRole('tab', { name: 'Rig setup' }));
  }

  it('commits a valid stage size and shows an invalid one inline', async () => {
    await openRig();
    const width = screen.getByRole('textbox', { name: 'Width (m)' });

    await userEvent.clear(width);
    await userEvent.type(width, '0');
    expect(screen.getByText('Must be at least 0.1')).toBeInTheDocument();
    expect(edits()).toEqual([]);

    await userEvent.type(width, '.5');
    expect(edits()).toEqual([{ type: 'setStage', stage: { width: 0.5, depth: 9 } }]);
  });

  it('adds a Universe, rejecting a number already in the patch', async () => {
    await openRig();
    const number = screen.getByRole('textbox', { name: 'Universe' });
    expect(number).toHaveValue('3');

    await userEvent.clear(number);
    await userEvent.type(number, '2');
    expect(screen.getByText('Universe 2 is already in the patch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Universe' })).toBeDisabled();

    await userEvent.clear(number);
    await userEvent.type(number, '5{Enter}');
    expect(edits()).toEqual([{ type: 'addUniverse', universe: { number: 5 } }]);
    expect(await screen.findByRole('cell', { name: '5' })).toBeInTheDocument();
    expect(number).toHaveValue('3');
  });

  it('removes a Universe, naming the Fixtures that went with it', async () => {
    await openRig();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Universe 2' }));
    expect(edits()).toEqual([{ type: 'removeUniverse', number: 2 }]);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Removed Universe 2 and its 1 Fixture: Spot',
    );
  });

  it('maps a Universe to an Output', async () => {
    await openRig();
    engine.emit({
      type: 'outputs',
      outputs: [{ id: 'usb-1', name: 'Enttec USB Pro', state: 'unused' }],
    });
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Output of Universe 1' }),
      'usb-1',
    );
    expect(edits()).toEqual([{ type: 'putUniverse', universe: { number: 1, output: 'usb-1' } }]);
  });
});
