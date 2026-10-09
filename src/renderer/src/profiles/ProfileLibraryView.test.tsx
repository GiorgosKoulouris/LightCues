import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FixtureProfile } from '../../../shared/fixture-profile';
import { blankChannel } from '../../../shared/profile-edit';
import type {
  CloseGuardBridge,
  EngineCommand,
  EngineEvent,
  FixtureImportResult,
  LibraryImportPreview,
  LibraryImportResult,
  ProfileLibraryEntry,
} from '../../../shared/protocol';
import { installFakeEngine, type FakeEngine } from '../test-engine';
import { UiProvider } from '../ui/UiProvider';
import { ProfileLibraryView } from './ProfileLibraryView';

const profile = (manufacturer: string, model: string, counts: number[]): FixtureProfile => ({
  id: `${manufacturer}/${model}`.toLowerCase(),
  manufacturer,
  model,
  defaultRole: 'Wash',
  modes: counts.map((count) => ({
    name: `${count}ch`,
    channels: Array.from({ length: count }, (_, i) => blankChannel(`Channel ${i + 1}`)),
  })),
});

const par = profile('Acme', 'Par', [3, 6]);
const spot = profile('Beamco', 'Spot', [16]);

let engine: FakeEngine;
const closeGuard = {
  setUnsaved: vi.fn(),
  onSaveBeforeClose: vi.fn<CloseGuardBridge['onSaveBeforeClose']>(() => () => {}),
};
const dialogs = {
  chooseLibraryToSave: vi.fn<(name: string, folder?: string) => Promise<string | undefined>>(),
  chooseLibraryToOpen: vi.fn<(folder?: string) => Promise<string | undefined>>(),
  showLibraryBackup: vi.fn<(path: string) => void>(),
};
let entries: ProfileLibraryEntry[];
// The folder the engine remembers for library files.
let folder: string | undefined;
// What the engine answers to the next export.
let exportErrors: string[];
// What the engine answers to the next save and imports.
let saveErrors: string[];
let importResults: FixtureImportResult[];
// What the engine answers to the next library import preview and confirm,
// and the library a confirmed import leaves.
let preview: LibraryImportPreview;
let imported: LibraryImportResult;
let importedEntries: ProfileLibraryEntry[];

function answer(command: EngineCommand): EngineEvent[] {
  const profiles = (): EngineEvent => ({ type: 'profiles', entries, folder });
  switch (command.type) {
    case 'listProfiles':
      return [profiles()];
    case 'saveProfile': {
      const { requestId, profile: saved, replaces } = command;
      const done: EngineEvent = { type: 'profileSaved', requestId, errors: saveErrors };
      if (saveErrors.length > 0) return [done];
      entries = [
        ...entries.filter((e) => e.profile.id !== replaces && e.profile.id !== saved.id),
        { profile: saved, handEdited: true },
      ];
      return [profiles(), done];
    }
    case 'deleteProfile':
      entries = entries.filter((e) => e.profile.id !== command.id);
      return [profiles()];
    case 'importOfl':
    case 'importGdtf':
      return [
        { type: 'fixtureImported', requestId: command.requestId, result: importResults.shift()! },
      ];
    case 'exportLibrary':
      return [{ type: 'libraryExported', requestId: command.requestId, errors: exportErrors }];
    case 'previewLibraryImport':
      return [{ type: 'libraryImportPreview', requestId: command.requestId, preview }];
    case 'confirmLibraryImport': {
      const done: EngineEvent = {
        type: 'libraryImported',
        requestId: command.requestId,
        result: imported,
      };
      if (imported.status !== 'imported') return [done];
      entries = importedEntries;
      return [profiles(), done];
    }
    default:
      return [];
  }
}

const sent = <T extends EngineCommand['type']>(type: T) =>
  engine.sent.filter((c): c is Extract<EngineCommand, { type: T }> => c.type === type);

async function renderView() {
  render(
    <UiProvider>
      <ProfileLibraryView active />
    </UiProvider>,
  );
  return screen.findByRole('listbox', { name: 'Profiles' });
}

const list = () => within(screen.getByRole('listbox', { name: 'Profiles' }));
const option = (name: string) => list().getByRole('option', { name: new RegExp(name) });
const editor = () => within(screen.getByRole('region', { name: 'Profile editor' }));
const dialog = () => within(screen.getByRole('dialog'));
const alertDialog = () => within(screen.getByRole('alertdialog'));

beforeEach(() => {
  entries = [
    { profile: par, handEdited: false },
    { profile: spot, handEdited: true },
  ];
  saveErrors = [];
  importResults = [];
  folder = undefined;
  exportErrors = [];
  preview = {
    status: 'readable',
    fileName: 'Profiles.lclibrary',
    currentCount: 2,
    keptCount: 1,
    skipped: [],
  };
  imported = { status: 'imported', keptCount: 1, backupPath: 'C:\\Data\\backups\\b.json' };
  importedEntries = [{ profile: spot, handEdited: false }];
  engine = installFakeEngine(answer);
  vi.stubGlobal('closeGuard', closeGuard);
  vi.stubGlobal('dialogs', dialogs);
  vi.stubGlobal('confirm', () => {
    throw new Error('window.confirm must not be used');
  });
});
afterEach(async () => {
  // Unmounts while the fake engine is still there. Unmounting answers an open
  // confirm with no, which may still send a command.
  cleanup();
  await new Promise((resolve) => setTimeout(resolve));
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Profile list', () => {
  it('lists Profiles with their source and modes, and searches them', async () => {
    await renderView();
    const user = userEvent.setup();

    expect(option('Acme Par')).toHaveTextContent('Imported');
    expect(option('Acme Par')).toHaveTextContent('2 modes · 3–6ch');
    expect(option('Beamco Spot')).toHaveTextContent('Edited');

    await user.type(screen.getByRole('searchbox', { name: 'Search Profiles' }), 'beam');
    expect(list().getAllByRole('option')).toHaveLength(1);
    expect(option('Beamco Spot')).toBeInTheDocument();
  });

  it('opens the selected Profile in the editor beside the list', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Beamco Spot'));

    expect(editor().getByRole('heading', { name: 'Beamco Spot' })).toBeInTheDocument();
    expect(editor().getByRole('textbox', { name: 'Model' })).toHaveValue('Spot');
    expect(screen.getByRole('listbox', { name: 'Profiles' })).toBeInTheDocument();
  });
});

describe('Profile list keyboard', () => {
  it('focuses the search on Ctrl+F', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.keyboard('{Control>}f{/Control}');
    expect(screen.getByRole('searchbox', { name: 'Search Profiles' })).toHaveFocus();
  });

  it('moves through the Profiles with the arrow keys', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Acme Par'));
    await user.keyboard('{ArrowDown}');
    expect(editor().getByRole('heading', { name: 'Beamco Spot' })).toBeInTheDocument();
  });

  it('does not delete on Del a Profile the search hides', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Acme Par'));
    await user.type(screen.getByRole('searchbox', { name: 'Search Profiles' }), 'beam');
    screen.getByRole('listbox', { name: 'Profiles' }).focus();
    await user.keyboard('{Delete}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('unsaved Profile edits', () => {
  async function editPar() {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Acme Par'));
    const model = editor().getByRole('textbox', { name: 'Model' });
    await user.clear(model);
    await user.type(model, 'Par 2');
    return user;
  }

  it('switches Profiles without asking when nothing changed', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Acme Par'));
    await user.click(option('Beamco Spot'));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(editor().getByRole('heading', { name: 'Beamco Spot' })).toBeInTheDocument();
  });

  it('asks before discarding them when switching Profiles, and keeps them on Cancel', async () => {
    const user = await editPar();
    expect(editor().getByText('Unsaved changes')).toBeInTheDocument();

    await user.click(option('Beamco Spot'));
    expect(alertDialog().getByRole('heading')).toHaveTextContent('Discard changes to Acme Par?');
    await user.click(alertDialog().getByRole('button', { name: 'Cancel' }));

    expect(editor().getByRole('textbox', { name: 'Model' })).toHaveValue('Par 2');
    expect(option('Acme Par')).toHaveAttribute('aria-selected', 'true');
  });

  it('switches Profiles when the discard is confirmed', async () => {
    const user = await editPar();
    await user.click(option('Beamco Spot'));
    await user.click(alertDialog().getByRole('button', { name: 'Discard' }));

    expect(editor().getByRole('heading', { name: 'Beamco Spot' })).toBeInTheDocument();
    await user.click(option('Acme Par'));
    expect(editor().getByRole('textbox', { name: 'Model' })).toHaveValue('Par');
  });

  it('asks before New Profile discards them', async () => {
    const user = await editPar();
    await user.click(screen.getByRole('button', { name: 'New Profile' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('reverts them on Cancel', async () => {
    const user = await editPar();
    await user.click(editor().getByRole('button', { name: 'Cancel' }));

    expect(editor().getByRole('textbox', { name: 'Model' })).toHaveValue('Par');
    expect(editor().queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('saves them to the library, replacing the Profile', async () => {
    const user = await editPar();
    await user.click(editor().getByRole('button', { name: 'Save' }));

    const [save] = sent('saveProfile');
    expect(save?.replaces).toBe('acme/par');
    expect(save?.profile).toMatchObject({ id: 'acme/par-2', model: 'Par 2' });
    expect(await screen.findByText('Acme Par 2 saved')).toBeInTheDocument();
    expect(editor().queryByText('Unsaved changes')).not.toBeInTheDocument();
    expect(option('Acme Par 2')).toHaveAttribute('aria-selected', 'true');
  });

  it('stays on the mode tab after a save that renames the Profile', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Acme Par'));
    const modes = () => within(editor().getByRole('tablist', { name: 'Modes' }));
    await user.click(modes().getByRole('tab', { name: /6ch/ }));
    await user.type(editor().getByRole('textbox', { name: 'Model' }), ' 2');
    await user.click(editor().getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Acme Par 2 saved')).toBeInTheDocument();
    expect(modes().getByRole('tab', { name: /6ch/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the engine’s errors and keeps them when the save is refused', async () => {
    saveErrors = ['Mode "3ch" has no channels'];
    const user = await editPar();
    await user.click(editor().getByRole('button', { name: 'Save' }));

    expect(await editor().findByRole('alert')).toHaveTextContent('Mode "3ch" has no channels');
    expect(editor().getByText('Unsaved changes')).toBeInTheDocument();

    await user.type(editor().getByRole('textbox', { name: 'Model' }), 'x');
    expect(editor().queryByRole('alert')).not.toBeInTheDocument();
  });

  it('asks before an import, which may replace the Profile', async () => {
    const user = await editPar();
    await user.click(screen.getByRole('button', { name: 'Import fixture' }));
    expect(alertDialog().getByRole('heading')).toHaveTextContent('Discard changes to Acme Par?');
    await user.click(alertDialog().getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('tells the close guard about them, and saves them when the window closes', async () => {
    await editPar();
    expect(closeGuard.setUnsaved).toHaveBeenLastCalledWith('profile', true);

    const saveBeforeClose = closeGuard.onSaveBeforeClose.mock.calls.at(-1)![1];
    let saved: boolean | undefined;
    await act(async () => {
      saved = await saveBeforeClose();
    });

    expect(saved).toBe(true);
    expect(sent('saveProfile')[0]?.profile.model).toBe('Par 2');
    expect(closeGuard.setUnsaved).toHaveBeenLastCalledWith('profile', false);
  });
});

describe('Profile editor fields', () => {
  it('does not take an out-of-range channel default, and reverts it on Esc', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Acme Par'));
    const table = within(editor().getByRole('table', { name: 'Channels' }));
    const defaultValue = table.getByRole('textbox', { name: 'Default of channel 1' });

    await user.clear(defaultValue);
    await user.paste('300');
    expect(defaultValue).toHaveAccessibleDescription('Must be 0–255');
    expect(editor().queryByText('Unsaved changes')).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(defaultValue).toHaveValue('0');
  });

  it('shows modes as tabs and channel numbers in the table', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Acme Par'));

    const modes = within(editor().getByRole('tablist', { name: 'Modes' }));
    await user.click(modes.getByRole('tab', { name: /6ch/ }));
    const rows = within(editor().getByRole('table', { name: 'Channels' })).getAllByRole('row');
    // A header row and six channels.
    expect(rows).toHaveLength(7);
    expect(rows[6]).toHaveTextContent('6');
  });
});

describe('deleting a Profile', () => {
  it('asks in-app before deleting', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Acme Par'));
    await user.click(editor().getByRole('button', { name: 'Delete Profile' }));

    expect(alertDialog().getByRole('heading')).toHaveTextContent('Delete Acme Par?');
    await user.click(alertDialog().getByRole('button', { name: 'Delete' }));

    expect(sent('deleteProfile')).toEqual([{ type: 'deleteProfile', id: 'acme/par' }]);
    expect(list().queryByRole('option', { name: /Acme Par/ })).not.toBeInTheDocument();
  });

  it('deletes the selected Profile on Del after the confirm', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Beamco Spot'));
    await user.keyboard('{Delete}');
    await user.click(alertDialog().getByRole('button', { name: 'Cancel' }));
    expect(sent('deleteProfile')).toEqual([]);
  });
});

describe('fixture import', () => {
  async function importPar(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Import fixture' }));
    const file = new File(['{"name":"Par"}'], 'par.json', { type: 'application/json' });
    await user.upload(dialog().getByLabelText('Fixture file'), file);
    await user.type(dialog().getByRole('textbox', { name: 'Manufacturer' }), 'Acme');
    await user.click(dialog().getByRole('button', { name: 'Import' }));
  }

  it('imports from a dialog and selects the new Profile', async () => {
    importResults = [
      { status: 'imported', profileId: 'acme/par', name: 'Acme Par', unsupported: [] },
    ];
    await renderView();
    const user = userEvent.setup();
    await importPar(user);

    expect(sent('importOfl')[0]).toMatchObject({
      json: { name: 'Par' },
      manufacturer: 'Acme',
      overwrite: false,
    });
    expect(await screen.findByText('Imported Acme Par')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(option('Acme Par')).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps Import disabled until a file and a manufacturer are given', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Import fixture' }));
    const manufacturer = dialog().getByRole('textbox', { name: 'Manufacturer' });
    await user.type(manufacturer, 'x');
    await user.clear(manufacturer);

    expect(manufacturer).toHaveAccessibleDescription('Name is required');
    expect(dialog().getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('lists unsupported features and stays open', async () => {
    importResults = [
      {
        status: 'imported',
        profileId: 'acme/par',
        name: 'Acme Par',
        unsupported: [{ feature: 'Prism', mode: '6ch', channel: 'Prism' }],
      },
    ];
    await renderView();
    const user = userEvent.setup();
    await importPar(user);

    expect(await dialog().findByText('Prism (mode 6ch) (channel Prism)')).toBeInTheDocument();
    await user.click(dialog().getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('overwrites a hand-edited Profile after an in-app confirm', async () => {
    importResults = [
      { status: 'conflict', profileId: 'acme/par', name: 'Acme Par' },
      { status: 'imported', profileId: 'acme/par', name: 'Acme Par', unsupported: [] },
    ];
    await renderView();
    const user = userEvent.setup();
    await importPar(user);

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Acme Par was edited by hand');
    await user.click(alertDialog().getByRole('button', { name: 'Overwrite' }));

    expect(sent('importOfl').map((c) => c.overwrite)).toEqual([false, true]);
    expect(await screen.findByText('Imported Acme Par')).toBeInTheDocument();
  });

  it('keeps the hand-edited Profile when the overwrite is declined', async () => {
    importResults = [{ status: 'conflict', profileId: 'acme/par', name: 'Acme Par' }];
    await renderView();
    const user = userEvent.setup();
    await importPar(user);
    await screen.findByRole('alertdialog');
    await user.click(alertDialog().getByRole('button', { name: 'Keep it' }));

    expect(await dialog().findByText('Kept the hand-edited Acme Par.')).toBeInTheDocument();
    expect(sent('importOfl')).toHaveLength(1);
  });

  it('shows a failed import in the dialog', async () => {
    importResults = [{ status: 'failed', error: 'No modes' }];
    await renderView();
    const user = userEvent.setup();
    await importPar(user);

    expect(await dialog().findByRole('alert')).toHaveTextContent('Import failed: No modes');
  });
  it('imports a .gdtf file, which names its own manufacturer', async () => {
    importResults = [
      { status: 'conflict', profileId: 'acme/par', name: 'Acme Par' },
      { status: 'imported', profileId: 'acme/par', name: 'Acme Par', unsupported: [] },
    ];
    await renderView();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Import fixture' }));
    const bytes = new Uint8Array([0x50, 0x4b, 3, 4]);
    await user.upload(dialog().getByLabelText('Fixture file'), new File([bytes], 'par.gdtf'));

    expect(dialog().queryByRole('textbox', { name: 'Manufacturer' })).not.toBeInTheDocument();
    await user.click(dialog().getByRole('button', { name: 'Import' }));
    await user.click(await alertDialog().findByRole('button', { name: 'Overwrite' }));

    const imports = sent('importGdtf');
    expect(imports.map((c) => c.overwrite)).toEqual([false, true]);
    expect([...imports[0]!.bytes]).toEqual([...bytes]);
    expect(sent('importOfl')).toEqual([]);
    expect(await screen.findByText('Imported Acme Par')).toBeInTheDocument();
  });

  it('rejects a .gdtf file over 256 MB without sending it', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Import fixture' }));
    const file = new File([new Uint8Array([0x50, 0x4b, 3, 4])], 'huge.gdtf');
    Object.defineProperty(file, 'size', { value: 256 * 1024 * 1024 + 1 });
    await user.upload(dialog().getByLabelText('Fixture file'), file);
    await user.click(dialog().getByRole('button', { name: 'Import' }));

    expect(await dialog().findByRole('alert')).toHaveTextContent(
      'huge.gdtf is too large (over 256 MB).',
    );
    expect(sent('importGdtf')).toEqual([]);
  });
});

describe('library export', () => {
  const exportButton = () => screen.getByRole('button', { name: 'Export…' });

  it('saves the library to the chosen file, suggesting a dated name in the last folder', async () => {
    folder = 'C:\\Backups';
    dialogs.chooseLibraryToSave.mockResolvedValue('C:\\Backups\\Profiles.lclibrary');
    await renderView();
    const user = userEvent.setup();
    await user.click(exportButton());

    expect(dialogs.chooseLibraryToSave).toHaveBeenCalledWith(
      expect.stringMatching(/^LightCues Profiles \d{4}-\d{2}-\d{2}\.lclibrary$/),
      'C:\\Backups',
    );
    expect(sent('exportLibrary')).toEqual([
      {
        type: 'exportLibrary',
        requestId: expect.any(Number),
        path: 'C:\\Backups\\Profiles.lclibrary',
      },
    ]);
    expect(await screen.findByText('Exported 2 Profiles')).toBeInTheDocument();
  });

  it('does nothing when the dialog is cancelled', async () => {
    dialogs.chooseLibraryToSave.mockResolvedValue(undefined);
    await renderView();
    const user = userEvent.setup();
    await user.click(exportButton());

    expect(dialogs.chooseLibraryToSave).toHaveBeenCalledTimes(1);
    expect(sent('exportLibrary')).toEqual([]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the engine’s error when the file cannot be written', async () => {
    exportErrors = ['Could not export C:\\Locked\\Profiles.lclibrary: Access denied'];
    dialogs.chooseLibraryToSave.mockResolvedValue('C:\\Locked\\Profiles.lclibrary');
    await renderView();
    const user = userEvent.setup();
    await user.click(exportButton());

    expect(
      await screen.findByText(
        'Export failed: Could not export C:\\Locked\\Profiles.lclibrary: Access denied',
      ),
    ).toBeInTheDocument();
  });

  it('is disabled when the library has no Profiles', async () => {
    entries = [];
    render(
      <UiProvider>
        <ProfileLibraryView active />
      </UiProvider>,
    );
    expect(await screen.findByText(/No Profiles yet/)).toBeInTheDocument();
    expect(exportButton()).toBeDisabled();
  });
});

describe('library import', () => {
  const importButton = () => screen.getByRole('button', { name: 'Import…' });

  async function startImport() {
    await renderView();
    const user = userEvent.setup();
    dialogs.chooseLibraryToOpen.mockResolvedValue('C:\\Backups\\Profiles.lclibrary');
    await user.click(importButton());
    return user;
  }

  it('reads the chosen file from the last library folder', async () => {
    folder = 'C:\\Backups';
    await startImport();

    expect(dialogs.chooseLibraryToOpen).toHaveBeenCalledWith('C:\\Backups');
    expect(sent('previewLibraryImport')).toEqual([
      {
        type: 'previewLibraryImport',
        requestId: expect.any(Number),
        path: 'C:\\Backups\\Profiles.lclibrary',
      },
    ]);
  });

  it('does nothing when the dialog is cancelled', async () => {
    await renderView();
    const user = userEvent.setup();
    dialogs.chooseLibraryToOpen.mockResolvedValue(undefined);
    await user.click(importButton());

    expect(sent('previewLibraryImport')).toEqual([]);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows why a rejected file cannot be imported', async () => {
    preview = { status: 'rejected', reason: 'Not a Profile Library file' };
    const user = await startImport();

    const notice = await screen.findByRole('alertdialog');
    expect(notice).toHaveTextContent('Not a Profile Library file');
    expect(within(notice).queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument();
    await user.click(within(notice).getByRole('button', { name: 'OK' }));
    expect(sent('confirmLibraryImport')).toEqual([]);
  });

  it('asks before replacing, with the counts and the skipped Profiles', async () => {
    preview = {
      status: 'readable',
      fileName: 'Profiles.lclibrary',
      currentCount: 2,
      keptCount: 1,
      skipped: [
        { index: 1, manufacturer: 'Acme', model: 'Bad', error: 'Mode "3ch" has no channels' },
        { index: 2, error: 'Not an object' },
      ],
    };
    await startImport();

    const ask = within(await screen.findByRole('alertdialog'));
    expect(
      ask.getByText(/^Replace 2 Profiles with 1 from Profiles\.lclibrary\./),
    ).toHaveTextContent('2 will be skipped.');
    const skipped = ask.getByRole('list', { name: 'Skipped Profiles' });
    expect(
      within(skipped)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Profile 2, Acme Bad: Mode "3ch" has no channels', 'Profile 3: Not an object']);
    expect(ask.queryByText(/unsaved changes/)).not.toBeInTheDocument();
  });

  it('lists no skipped Profiles when there are none', async () => {
    await startImport();

    const ask = within(await screen.findByRole('alertdialog'));
    expect(ask.getByText('Replace 2 Profiles with 1 from Profiles.lclibrary.')).toBeInTheDocument();
    expect(ask.queryByRole('list')).not.toBeInTheDocument();
  });

  it('warns that unsaved Profile edits will be discarded', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Acme Par'));
    await user.type(editor().getByRole('textbox', { name: 'Model' }), ' 2');
    dialogs.chooseLibraryToOpen.mockResolvedValue('C:\\Backups\\Profiles.lclibrary');
    await user.click(importButton());

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'The Profile Editor has unsaved changes. They will be discarded.',
    );
  });

  it('drops the pending import on Cancel', async () => {
    const user = await startImport();
    // Behind the modal confirm.
    expect(screen.getByRole('button', { name: 'Import…', hidden: true })).toBeDisabled();
    await user.click(await alertDialog().findByRole('button', { name: 'Cancel' }));

    expect(sent('cancelLibraryImport')).toHaveLength(1);
    expect(sent('confirmLibraryImport')).toEqual([]);
    expect(importButton()).toBeEnabled();
    expect(option('Acme Par')).toBeInTheDocument();
  });

  it('replaces the library on Replace, and offers to show the backup', async () => {
    const user = await startImport();
    await user.click(await alertDialog().findByRole('button', { name: 'Replace' }));

    expect(sent('confirmLibraryImport')).toHaveLength(1);
    expect(await screen.findByText('Imported 1 Profile. Backup saved.')).toBeInTheDocument();
    expect(list().getAllByRole('option')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Show in folder' }));
    expect(dialogs.showLibraryBackup).toHaveBeenCalledWith('C:\\Data\\backups\\b.json');
  });

  it('shows why the backup failed, and keeps the library and the edits', async () => {
    imported = { status: 'failed', error: 'Could not back up the Profile Library: Disk full' };
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Acme Par'));
    await user.type(editor().getByRole('textbox', { name: 'Model' }), ' 2');
    dialogs.chooseLibraryToOpen.mockResolvedValue('C:\\Backups\\Profiles.lclibrary');
    await user.click(importButton());
    await user.click(await alertDialog().findByRole('button', { name: 'Replace' }));

    expect(await alertDialog().findByText(/Disk full/)).toBeInTheDocument();
    await user.click(alertDialog().getByRole('button', { name: 'OK' }));
    expect(editor().getByRole('textbox', { name: 'Model' })).toHaveValue('Par 2');
    expect(list().getAllByRole('option')).toHaveLength(2);
  });

  it('reselects the open Profile when the import keeps it, discarding edits', async () => {
    importedEntries = [{ profile: { ...spot, defaultRole: 'Blinder' }, handEdited: false }];
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Beamco Spot'));
    await user.type(editor().getByRole('textbox', { name: 'Model' }), ' 2');
    dialogs.chooseLibraryToOpen.mockResolvedValue('C:\\Backups\\Profiles.lclibrary');
    await user.click(importButton());
    await user.click(await alertDialog().findByRole('button', { name: 'Replace' }));

    await screen.findByText('Imported 1 Profile. Backup saved.');
    expect(editor().getByRole('heading', { name: 'Beamco Spot' })).toBeInTheDocument();
    expect(editor().getByRole('textbox', { name: 'Model' })).toHaveValue('Spot');
    expect(editor().queryByText('Unsaved changes')).not.toBeInTheDocument();
    expect(option('Beamco Spot')).toHaveAttribute('aria-selected', 'true');
  });

  it('closes the editor when the import drops the open Profile', async () => {
    await renderView();
    const user = userEvent.setup();
    await user.click(option('Acme Par'));
    dialogs.chooseLibraryToOpen.mockResolvedValue('C:\\Backups\\Profiles.lclibrary');
    await user.click(importButton());
    await user.click(await alertDialog().findByRole('button', { name: 'Replace' }));

    await screen.findByText('Imported 1 Profile. Backup saved.');
    expect(screen.queryByRole('region', { name: 'Profile editor' })).not.toBeInTheDocument();
    expect(screen.getByText('Select a Profile to edit it, or make a new one.')).toBeInTheDocument();
  });
});
