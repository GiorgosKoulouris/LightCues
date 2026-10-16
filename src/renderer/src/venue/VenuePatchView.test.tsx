import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FixtureProfile } from '../../../shared/fixture-profile';
import type { EngineCommand, EngineEvent, VenueEdit } from '../../../shared/protocol';
import type { Direction, Rule, Show } from '../../../shared/show';
import {
  addUniverse,
  DEFAULT_MOUNTING,
  moveFixture,
  putFixture,
  putFixtures,
  putHouseGroup,
  putHouseLight,
  putUniverse,
  removeFixtures,
  removeHouseGroup,
  removeHouseLights,
  removeUniverse,
  setHouseLook,
  setStage,
  setStartupLook,
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
// The engine's Show; none sent when absent.
let show: Show | undefined;
// The engine's Focus Check Direction; off when absent.
let focusCheck: Direction | undefined;
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
    case 'getShow':
      return show ? [{ type: 'show', show, unsaved: false, canUndo: false, canRedo: false }] : [];
    case 'setFocusCheck':
      focusCheck = command.direction;
      return [playbackEvent()];
    case 'getPlayback':
      return [playbackEvent()];
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

function playbackEvent(): EngineEvent {
  return {
    type: 'playback',
    active: {},
    mode: 'monitor',
    grandMaster: 1,
    blackout: false,
    freeze: false,
    ...(focusCheck === undefined ? {} : { focusCheck }),
  };
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
    case 'putHouseGroup':
      return putHouseGroup(current, edit.group);
    case 'removeHouseGroup':
      return { patch: removeHouseGroup(current, edit.id) };
    case 'putHouseLight':
      return putHouseLight(current, edit.light, par);
    case 'removeHouseLights':
      return { patch: removeHouseLights(current, edit.ids) };
    case 'setStartupLook':
      return setStartupLook(current, edit.look);
    case 'setHouseLook':
      return setHouseLook(current, edit.preset, edit.look);
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
  show = undefined;
  focusCheck = undefined;
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

// A moving head whose Profile gives no pan or tilt degrees.
const head: FixtureProfile = {
  id: 'acme/head',
  manufacturer: 'Acme',
  model: 'Head',
  defaultRole: 'Spot/Beam',
  modes: [
    {
      name: '2ch',
      channels: [
        {
          kind: 'control',
          name: 'Pan',
          defaultValue: 128,
          ranges: [{ from: 0, to: 255, capability: { type: 'pan' } }],
        },
        {
          kind: 'control',
          name: 'Tilt',
          defaultValue: 128,
          ranges: [{ from: 0, to: 255, capability: { type: 'tilt' } }],
        },
      ],
    },
  ],
};
const mover = fixture('Head', { profileId: 'acme/head', mode: '2ch', universe: 2, address: 10 });

describe('Mounting', () => {
  beforeEach(() => {
    patch = { ...PATCH, profiles: [par, head], fixtures: [...PATCH.fixtures, mover] };
  });

  const mounting = () => within(inspector().getByRole('group', { name: 'Mounting' }));
  const lastMounting = () => {
    const edit = edits().at(-1);
    return edit?.type === 'putFixtures' ? edit.fixtures[0]?.mounting : undefined;
  };

  it('shows Mounting fields only for a moving Fixture', async () => {
    await renderView();
    const user = userEvent.setup();

    await user.click(option('Par 1'));
    expect(inspector().queryByRole('group', { name: 'Mounting' })).not.toBeInTheDocument();

    await user.click(option('Head'));
    expect(mounting().getByRole('combobox', { name: 'Mounted' })).toHaveDisplayValue('Hung');
    expect(mounting().getByRole('textbox', { name: 'Rotation (°)' })).toHaveValue('0');
    expect(mounting().getByRole('button', { name: '0°' })).toHaveAttribute('aria-pressed', 'true');
    expect(mounting().getByRole('checkbox', { name: 'Invert pan' })).not.toBeChecked();
    expect(mounting().getByRole('checkbox', { name: 'Invert tilt' })).not.toBeChecked();
    expect(mounting().getByRole('textbox', { name: 'Pan offset (°)' })).toHaveValue('0');
    expect(mounting().getByRole('textbox', { name: 'Tilt offset (°)' })).toHaveValue('0');
  });

  it('commits each Mounting field at once', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Head'));

    await user.selectOptions(mounting().getByRole('combobox', { name: 'Mounted' }), 'Standing');
    expect(lastMounting()).toEqual({ ...DEFAULT_MOUNTING, mount: 'Standing' });

    await user.click(mounting().getByRole('button', { name: '180°' }));
    expect(lastMounting()).toEqual({ ...DEFAULT_MOUNTING, mount: 'Standing', rotation: 180 });
    expect(mounting().getByRole('textbox', { name: 'Rotation (°)' })).toHaveValue('180');

    await user.click(mounting().getByRole('checkbox', { name: 'Invert tilt' }));
    expect(lastMounting()).toMatchObject({ tiltInvert: true, panInvert: false });

    const offset = mounting().getByRole('textbox', { name: 'Pan offset (°)' });
    await user.clear(offset);
    await user.paste('-2.5');
    expect(lastMounting()).toEqual({
      ...DEFAULT_MOUNTING,
      mount: 'Standing',
      rotation: 180,
      tiltInvert: true,
      panOffset: -2.5,
    });
  });

  it('normalises a typed rotation to 0 to under 360', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Head'));
    const rotation = mounting().getByRole('textbox', { name: 'Rotation (°)' });

    await user.clear(rotation);
    await user.type(rotation, '450');
    expect(lastMounting()).toEqual({ ...DEFAULT_MOUNTING, rotation: 90 });
    expect(rotation).toHaveValue('450');

    await user.tab();
    expect(rotation).toHaveValue('90');
    expect(mounting().getByRole('button', { name: '90°' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Approximated aims', () => {
  beforeEach(() => {
    patch = { ...PATCH, profiles: [par, head], fixtures: [...PATCH.fixtures, mover] };
    show = {
      layers: [{ id: 'l1', name: 'Layer 1' }],
      scenes: [
        {
          id: 's1',
          name: 'Up',
          tags: [],
          layer: 'l1',
          fadeIn: 0,
          rules: [{ target: {}, direction: 'Up' }],
        },
      ],
      triggers: [],
    };
  });

  const warning = () => inspector().queryByRole('region', { name: 'Approximated aims' });

  it('names the Directions a mover only approximates, and why', async () => {
    await renderView();
    const user = userEvent.setup();

    await user.click(option('Head'));
    const items = within(warning()!).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Down: pan range assumed (540°), tilt range assumed (270°)',
      'Up: pan range assumed (540°), tilt range assumed (270°), out of reach',
    ]);
    expect(warning()).toHaveTextContent(
      'Add the pan and tilt degrees to its Profile in the Profile editor.',
    );
  });

  it('names only the axes whose degrees the Profile lacks', async () => {
    const ranged: FixtureProfile = {
      ...head,
      modes: head.modes.map((mode) => ({
        ...mode,
        channels: mode.channels.map((channel) =>
          channel.kind === 'control' && channel.name === 'Tilt'
            ? {
                ...channel,
                ranges: [{ from: 0, to: 255, capability: { type: 'tilt', degrees: [-135, 135] } }],
              }
            : channel,
        ),
      })),
    };
    patch = { ...patch, profiles: [par, ranged] };
    await renderView();
    const user = userEvent.setup();

    await user.click(option('Head'));
    expect(warning()).toHaveTextContent('Up: pan range assumed (540°), out of reach');
    expect(warning()).toHaveTextContent('Add the pan degrees to its Profile');
  });

  it('shows nothing on a Fixture that does not move', async () => {
    await renderView();
    const user = userEvent.setup();

    await user.click(option('Par 1'));
    expect(warning()).not.toBeInTheDocument();
  });
});

describe('Approximated strobe', () => {
  // A strobe range without a Hz span.
  const unspanned: FixtureProfile = {
    ...par,
    id: 'acme/unspanned',
    model: 'Unspanned',
    modes: [
      {
        name: '3ch',
        channels: [
          ...channels(2),
          {
            kind: 'control',
            name: 'Strobe',
            defaultValue: 0,
            ranges: [{ from: 0, to: 255, capability: { type: 'strobe' } }],
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    patch = {
      ...PATCH,
      profiles: [par, unspanned],
      fixtures: [...PATCH.fixtures, fixture('Strobe 1', { profileId: unspanned.id, address: 100 })],
    };
    const strobing = (id: string, name: string, strobe: Rule['strobe']) => ({
      ...{ id, name, tags: [], layer: 'l1', fadeIn: 0 },
      rules: [{ target: {}, strobe }],
    });
    show = {
      layers: [{ id: 'l1', name: 'Layer 1' }],
      scenes: [strobing('s1', 'Hit', 'Fast'), strobing('s2', 'Calm', 'Off')],
      triggers: [],
    };
  });

  const warning = () => inspector().queryByRole('region', { name: 'Approximated strobe' });

  it('names the Scenes that strobe a Fixture with no strobe channel', async () => {
    await renderView();
    await userEvent.click(option('Par 1'));

    expect(warning()).toHaveTextContent(
      'Strobed by Hit: it has no strobe channel, so it stays steady.',
    );
  });

  it('says when a strobe rate has no Hz span', async () => {
    await renderView();
    await userEvent.click(option('Strobe 1'));

    expect(warning()).toHaveTextContent(
      'Strobed by Hit: its Profile gives no strobe rate in Hz, so 1–20 Hz is assumed.',
    );
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
    expect(listOptions()).toHaveLength(1);
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

  it('maps a Universe to the Virtual Output, saying it needs no hardware', async () => {
    await openRig();
    engine.emit({
      type: 'outputs',
      outputs: [{ id: 'virtual', name: 'Virtual Output', state: 'unused' }],
    });
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Output of Universe 1' }),
      'Virtual Output',
    );
    expect(edits()).toEqual([{ type: 'putUniverse', universe: { number: 1, output: 'virtual' } }]);
    expect(await screen.findByText('No hardware. See the channel monitor.')).toBeInTheDocument();
  });
});

describe('House', () => {
  const previews = () => engine.sent.filter((c) => c.type === 'previewHouseLook');
  const white = { swatch: 'White' };

  async function openHouse() {
    await renderView();
    await userEvent.click(screen.getByRole('tab', { name: 'House' }));
  }

  it('adds a House Group and a House Light, and sets the Startup look live', async () => {
    await openHouse();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add House Group' }));
    const [added] = edits();
    if (added?.type !== 'putHouseGroup') throw new Error('No House Group added');
    const { id } = added.group;
    expect(added.group.name).toBe('House Group 1');
    const name = await screen.findByRole('textbox', { name: 'House Group name' });
    await user.clear(name);
    await user.type(name, 'Bar');
    expect(edits().at(-1)).toEqual({ type: 'putHouseGroup', group: { id, name: 'Bar' } });

    const group = within(await screen.findByRole('region', { name: 'House Group Bar' }));
    expect(group.getByText('No House Lights yet.')).toBeInTheDocument();
    await user.click(group.getByRole('button', { name: 'Add House Light' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add House Light' }));
    // After Par 8, the last Fixture in Universe 1.
    expect(dialog.getByRole('textbox', { name: 'Address' })).toHaveValue('25');
    await user.click(dialog.getByRole('button', { name: 'Add' }));
    expect(edits().at(-1)).toEqual({
      type: 'putHouseLight',
      light: expect.objectContaining({ name: 'Par 10', group: id, universe: 1, address: 25 }),
    });
    expect(await group.findByRole('textbox', { name: 'Address of Par 10' })).toHaveValue('25');

    expect(previews()).toEqual([]);
    const look = within(screen.getByRole('group', { name: 'Bar' }));
    await user.click(look.getByRole('checkbox', { name: 'Set in this look' }));
    expect(edits().at(-1)).toEqual({
      type: 'setStartupLook',
      look: { [id]: { intensity: 1, colour: white } },
    });
    fireEvent.change(await look.findByRole('slider', { name: 'Bar intensity' }), {
      target: { value: '40' },
    });
    const dim = { [id]: { intensity: 0.4, colour: white } };
    expect(edits().at(-1)).toEqual({ type: 'setStartupLook', look: dim });
    await vi.waitFor(() =>
      expect(previews().at(-1)).toEqual({ type: 'previewHouseLook', look: dim }),
    );

    await user.click(screen.getByRole('tab', { name: 'Fixtures' }));
    expect(previews().at(-1)).toEqual({ type: 'previewHouseLook' });
  });

  it('removes a House Group, naming the House Lights that went with it', async () => {
    patch = { ...PATCH, house: { groups: [{ id: 'bar', name: 'Bar' }], lights: [] } };
    const light = { id: 'h1', name: 'Bar 1', group: 'bar', profileId: 'acme/par', mode: '3ch' };
    patch = {
      ...patch,
      house: { ...patch.house!, lights: [{ ...light, universe: 1, address: 30 }] },
    };
    await openHouse();

    await userEvent.click(screen.getByRole('button', { name: 'Remove House Group Bar' }));

    expect(edits()).toEqual([{ type: 'removeHouseGroup', id: 'bar' }]);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Removed Bar and its 1 House Light: Bar 1',
    );
  });

  it('shows a House Light change that does not fit inline, without sending it', async () => {
    const light = { id: 'h1', name: 'Bar 1', group: 'bar', profileId: 'acme/par', mode: '3ch' };
    const lights = [
      { ...light, universe: 1, address: 25 },
      { ...light, id: 'h2', name: 'Bar 2', universe: 1, address: 28 },
    ];
    patch = { ...PATCH, house: { groups: [{ id: 'bar', name: 'Bar' }], lights } };
    await openHouse();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Mode of Bar 1' }), '6ch');

    expect(
      screen.getByText('"Bar 2" (1.28–1.30) overlaps "Bar 1" (1.25–1.30)'),
    ).toBeInTheDocument();
    expect(edits()).toEqual([]);
  });

  describe('house looks', () => {
    const bar = { groups: [{ id: 'bar', name: 'Bar' }], lights: [] };
    const amber = { intensity: 0.2, colour: { swatch: 'Amber' as const } };
    const presets = (...names: string[]): Show => ({
      layers: [],
      scenes: [],
      triggers: [],
      housePresets: names.map((name) => ({ id: name.toLowerCase(), name, fade: 2 })),
    });
    const look = (name: string) => within(screen.getByRole('region', { name }));

    it('sets the look of a House Preset of the Show live, by name', async () => {
      show = presets('Dim', 'Up');
      patch = { ...PATCH, house: { ...bar, looks: { up: { bar: amber } } } };
      await openHouse();
      const user = userEvent.setup();

      const dim = within(await screen.findByRole('region', { name: 'House look Dim' }));
      expect(dim.getByText('Not set up in this venue')).toBeInTheDocument();
      expect(look('House look Up').queryByText('Not set up in this venue')).toBeNull();
      expect(look('House look Up').getByRole('slider', { name: 'Bar intensity' })).toHaveValue(
        '20',
      );

      await user.click(dim.getByRole('checkbox', { name: 'Set in this look' }));
      const full = { bar: { intensity: 1, colour: white } };
      expect(edits()).toEqual([{ type: 'setHouseLook', preset: 'dim', look: full }]);
      await vi.waitFor(() =>
        expect(previews().at(-1)).toEqual({ type: 'previewHouseLook', look: full }),
      );
      expect(dim.queryByText('Not set up in this venue')).toBeNull();

      await user.click(dim.getByRole('checkbox', { name: 'Set in this look' }));
      expect(edits().at(-1)).toEqual({ type: 'setHouseLook', preset: 'dim' });

      await user.click(screen.getByRole('tab', { name: 'Fixtures' }));
      expect(previews().at(-1)).toEqual({ type: 'previewHouseLook' });
    });

    it('lists a look for a House Preset not in the Show, and removes it', async () => {
      show = presets('Dim');
      patch = { ...PATCH, house: { ...bar, looks: { gone: { bar: amber } } } };
      await openHouse();

      const other = within(await screen.findByRole('region', { name: 'Other look 1' }));
      expect(other.getByText('Not in this Show')).toBeInTheDocument();
      expect(other.getByRole('slider', { name: 'Bar intensity' })).toHaveValue('20');
      await userEvent.click(other.getByRole('button', { name: 'Remove Other look 1' }));

      expect(edits()).toEqual([{ type: 'setHouseLook', preset: 'gone' }]);
      expect(await screen.findByRole('status')).toHaveTextContent('Removed Other look 1');
      expect(screen.queryByRole('region', { name: 'Other look 1' })).toBeNull();
    });

    it('marks every House Preset not set up before a House Group is added', async () => {
      show = presets('Dim');
      await openHouse();

      const dim = within(await screen.findByRole('region', { name: 'House look Dim' }));
      expect(dim.getByText('Not set up in this venue')).toBeInTheDocument();
      expect(screen.getByText('Add a House Group to set the house looks.')).toBeInTheDocument();
    });

    it('shows only the Startup look and the stored looks with no Show', async () => {
      patch = { ...PATCH, house: { ...bar, looks: { gone: { bar: amber } } } };
      await openHouse();

      expect(screen.getByRole('region', { name: 'Startup look' })).toBeInTheDocument();
      const other = look('Other look 1');
      expect(other.queryByText('Not in this Show')).toBeNull();
      expect(screen.queryByRole('region', { name: /^House look/ })).toBeNull();
    });
  });
});

describe('Fixture labels', () => {
  const label = (id: string) => screen.getByTestId(`plan-${id}`).querySelector('text');
  const toggle = () => screen.getByRole('button', { name: 'Fixture labels' });

  beforeEach(() => localStorage.clear());

  it('hides and shows the labels on the plan, keeping the tooltips', async () => {
    await renderView();
    const user = userEvent.setup();
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    expect(label('par-1')).toHaveTextContent('Par 1');

    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(label('par-1')).toBeNull();
    expect(screen.getByTestId('plan-par-1').querySelector('title')).toHaveTextContent('Par 1');

    await user.click(toggle());
    expect(label('par-1')).toHaveTextContent('Par 1');
  });

  it('keeps the labels of the selected Fixtures', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(toggle());
    await user.click(option('Par 2'));
    expect(label('par-2')).toHaveTextContent('Par 2');
    expect(label('par-1')).toBeNull();
  });

  it('remembers the setting after a remount, outside the Venue Patch', async () => {
    await renderView();
    await userEvent.setup().click(toggle());
    cleanup();

    await renderView();
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(label('par-1')).toBeNull();
    expect(edits()).toEqual([]);
  });

  it('is shown on the Fixtures tab only', async () => {
    await renderView();
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Rig setup' }));
    expect(screen.queryByRole('button', { name: 'Fixture labels' })).toBeNull();
  });
});

describe('Focus Check', () => {
  const focusChecks = () =>
    engine.sent.flatMap((c) => (c.type === 'setFocusCheck' ? [c.direction] : []));

  it('sends the movers to the Direction picked, and ends when the view is left', async () => {
    const view = (active: boolean) => (
      <UiProvider>
        <VenuePatchView active={active} />
      </UiProvider>
    );
    const { rerender } = render(view(true));
    const control = await screen.findByRole('combobox', { name: 'Focus Check' });
    expect(control).toHaveValue('');

    await userEvent.setup().selectOptions(control, 'Audience');
    expect(focusChecks()).toEqual(['Audience']);
    await vi.waitFor(() => expect(control).toHaveValue('Audience'));

    rerender(view(false));
    expect(focusChecks()).toEqual(['Audience', undefined]);
    await vi.waitFor(() => expect(control).toHaveValue(''));
  });

  it("draws the movers' beams on the stage plan while it is on", async () => {
    await renderView();
    const control = await screen.findByRole('combobox', { name: 'Focus Check' });
    const beam = () => screen.queryByTestId('beam-spot');
    const plan = screen.getByRole('img', { name: 'Top-down stage plan' });
    const viewBox = plan.getAttribute('viewBox');

    await userEvent.setup().selectOptions(control, 'Audience');
    await vi.waitFor(() => expect(engine.sent).toContainEqual({ type: 'startPreview' }));
    const aim = { pan: 0, tilt: 90 };
    engine.emit({
      type: 'preview',
      lights: { spot: { intensity: 1, red: 1, green: 1, blue: 1, aim } },
    });
    expect(beam()).not.toBeNull();
    // Cut at the plan's edge, which stays put.
    expect(screen.getByTestId('beam-arrow-spot')).toBeInTheDocument();
    expect(plan.getAttribute('viewBox')).toEqual(viewBox);

    await userEvent.setup().selectOptions(control, '');
    await vi.waitFor(() => expect(beam()).toBeNull());
    expect(engine.sent.at(-1)).toEqual({ type: 'stopPreview' });
    expect(plan.getAttribute('viewBox')).toEqual(viewBox);
  });
});

describe('Channel monitor', () => {
  const monitorCommands = () =>
    engine.sent.filter((c) => c.type === 'monitorUniverse' || c.type === 'stopMonitor');

  it('opens and closes from its toggle, on either tab, and closes when the view is left', async () => {
    const view = (active: boolean) => (
      <UiProvider>
        <VenuePatchView active={active} />
      </UiProvider>
    );
    const { rerender } = render(view(true));
    const toggle = await screen.findByRole('button', { name: 'Channel monitor' });
    const user = userEvent.setup();
    expect(screen.queryByRole('region', { name: 'Channel monitor' })).toBeNull();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Channel monitor' })).toBeInTheDocument();
    expect(monitorCommands()).toEqual([{ type: 'monitorUniverse', universe: 1 }]);

    await user.click(screen.getByRole('tab', { name: 'Rig setup' }));
    expect(screen.getByRole('region', { name: 'Channel monitor' })).toBeInTheDocument();

    rerender(view(false));
    expect(monitorCommands().at(-1)).toEqual({ type: 'stopMonitor' });
    rerender(view(true));
    expect(monitorCommands().at(-1)).toEqual({ type: 'monitorUniverse', universe: 1 });

    await user.click(toggle);
    expect(screen.queryByRole('region', { name: 'Channel monitor' })).toBeNull();
    expect(monitorCommands().at(-1)).toEqual({ type: 'stopMonitor' });
  });
});
