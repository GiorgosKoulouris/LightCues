import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { VenueEdit } from '../../../shared/protocol';
import { DIRECTIONS, type Direction } from '../../../shared/show';
import {
  fixturesInUniverse,
  type PatchedFixture,
  type VenuePatch,
} from '../../../shared/venue-patch';
import { useProfileLibrary } from '../profiles/useProfileLibrary';
import { FileButtons } from '../shell/FileButtons';
import { HistoryButtons } from '../shell/HistoryButtons';
import { useFileCommands } from '../shell/useFileCommands';
import { useFileShortcuts, useFindShortcut, useHistoryShortcuts } from '../shell/useShortcuts';
import { BeamLines } from '../show/BeamLines';
import { usePlayback } from '../show/usePlayback';
import { usePreview } from '../show/usePreview';
import { useShow } from '../show/useShow';
import type { SelectModifiers } from '../ui/List';
import { namedCount, removedMessage } from '../ui/removed';
import { Select } from '../ui/Select';
import { SidePanel, SidePanelToggle } from '../ui/SidePanel';
import { Tabs } from '../ui/Tabs';
import { useToast } from '../ui/Toast';
import { AddFixtureDialog } from './AddFixtureDialog';
import { FixtureInspector } from './FixtureInspector';
import { FixtureList } from './FixtureList';
import {
  filterFixtures,
  selectFixture,
  sortFixtures,
  type FixtureFilter,
  type Selection,
} from './fixtures';
import { RigSetup } from './RigSetup';
import { StagePlan } from './StagePlan';
import { useOutputs } from './useOutputs';
import { useVenuePatch } from './useVenuePatch';
import styles from './VenuePatchView.module.css';

type SubTab = 'fixtures' | 'rig';

const TABS = [
  { value: 'fixtures', label: 'Fixtures' },
  { value: 'rig', label: 'Rig setup' },
] as const;

const FOCUS_CHECK_OPTIONS = [
  { value: '', label: 'Focus Check: Off' },
  ...DIRECTIONS.map((d) => ({ value: d, label: `Focus Check: ${d}` })),
] as const;

// Edits the current Venue Patch. Fixtures: the Fixture list, the stage plan
// and the inspector, with Shift/Ctrl multi-select in the list and on the plan.
// Rig setup: stage size, Universes and Outputs. Removing is instant, and
// undone with Undo. While `active`, Ctrl+N, O, S and Shift+S act on its file,
// Ctrl+Z and Ctrl+Shift+Z undo and redo, and Ctrl+F searches the Fixtures.
// The Focus Check, on either tab, ends when the view is left. While it is on,
// the plan shows the beams out to the audience plane.
export function VenuePatchView({ active }: { active: boolean }) {
  const { venue, edit, newVenue, undo, redo, open, save } = useVenuePatch();
  const focusCheck = usePlayback()?.focusCheck;
  const { entries } = useProfileLibrary();
  const show = useShow().show?.show;
  const outputs = useOutputs();
  const toast = useToast();
  const [tab, setTab] = useState<SubTab>('fixtures');
  const [selection, setSelection] = useState<Selection>({ ids: [] });
  const [filter, setFilter] = useState<FixtureFilter>({ query: '', grouping: 'universe' });
  const [adding, setAdding] = useState(false);
  // The inspector, below 1280px where it is hidden by default.
  const [sideOpen, setSideOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { run, fileCommands } = useFileCommands({
    kind: 'venue',
    name: 'Venue Patch',
    unsaved: venue?.unsaved,
    newFile: newVenue,
    open,
    save,
    onReplaced: () => setSelection({ ids: [] }),
  });
  useFileShortcuts(active, fileCommands);
  useHistoryShortcuts(active, { undo, redo });
  useFindShortcut(active && tab === 'fixtures', () => {
    searchRef.current?.focus();
    searchRef.current?.select();
  });
  useEffect(() => {
    if (!active) return;
    return () => window.engine.send({ type: 'setFocusCheck' });
  }, [active]);

  if (!venue || !fileCommands) return <p className={styles.loading}>Loading Venue Patch…</p>;
  const { patch } = venue;
  const change = (venueEdit: VenueEdit) => run(() => edit(venueEdit));

  const listed = sortFixtures(patch, filterFixtures(patch, filter.query), filter.grouping);
  // Fixtures removed elsewhere, such as with their Universe, drop out.
  const selected = selection.ids.flatMap((id) => patch.fixtures.find((f) => f.id === id) ?? []);
  const selectedIds = selected.map((f) => f.id);

  // A Shift range follows `order`: the list's for a list click; on the plan,
  // which shows every Fixture, the list's order without the search.
  const select = (order: PatchedFixture[]) => (id: string, modifiers: SelectModifiers) =>
    setSelection(
      selectFixture(
        { ...selection, ids: selectedIds },
        id,
        order.map((f) => f.id),
        modifiers,
      ),
    );

  async function removeSelected() {
    if (selected.length === 0) return;
    if (!(await change({ type: 'removeFixtures', ids: selectedIds }))) return;
    setSelection({ ids: [] });
    toast({
      message:
        selected.length === 1
          ? removedMessage(selected[0]!.name)
          : removedMessage(namedCount('Fixture', names(selected))),
    });
  }

  async function removeUniverse(number: number) {
    const fixtures = fixturesInUniverse(patch, number);
    if (!(await change({ type: 'removeUniverse', number }))) return;
    const also = fixtures.length > 0 ? [`its ${namedCount('Fixture', names(fixtures))}`] : [];
    toast({ message: removedMessage(`Universe ${number}`, also) });
  }

  const onDelete = (event: KeyboardEvent) => {
    if (event.key !== 'Delete') return;
    event.preventDefault();
    void removeSelected();
  };

  return (
    <Tabs
      label="Venue Patch"
      tabs={TABS}
      value={tab}
      onChange={setTab}
      className={styles.view}
      actions={
        <>
          {tab === 'fixtures' && (
            <SidePanelToggle
              label="inspector"
              open={sideOpen}
              onToggle={() => setSideOpen(!sideOpen)}
            />
          )}
          <Select<Direction | ''>
            label="Focus Check"
            hideLabel
            value={focusCheck ?? ''}
            options={FOCUS_CHECK_OPTIONS}
            onChange={(direction) =>
              window.engine.send({
                type: 'setFocusCheck',
                ...(direction === '' ? {} : { direction }),
              })
            }
          />
          <HistoryButtons
            commands={{ undo, redo }}
            enabled={{ undo: venue.canUndo, redo: venue.canRedo }}
          />
          <FileButtons commands={fileCommands} />
        </>
      }
    >
      {tab === 'fixtures' ? (
        <div className={styles.fixtures}>
          <FixtureList
            patch={patch}
            fixtures={listed}
            filter={filter}
            selection={{ ...selection, ids: selectedIds }}
            searchRef={searchRef}
            onFilter={setFilter}
            onSelect={select(listed)}
            onRemove={() => void removeSelected()}
            onAdd={() => setAdding(true)}
          />
          <StagePlan
            patch={patch}
            selectedIds={selectedIds}
            onSelect={select(sortFixtures(patch, patch.fixtures, filter.grouping))}
            onKeyDown={onDelete}
            onMove={(id, position) => change({ type: 'moveFixture', id, position })}
            audience={focusCheck !== undefined}
          >
            {focusCheck !== undefined && <FocusCheckBeams patch={patch} />}
          </StagePlan>
          <SidePanel label="Inspector" open={sideOpen} onClose={() => setSideOpen(false)}>
            {selected.length > 0 ? (
              <FixtureInspector
                key={selectedIds.join()}
                patch={patch}
                show={show}
                fixtures={selected}
                onPut={(fixtures) => void change({ type: 'putFixtures', fixtures })}
                onRemove={() => void removeSelected()}
              />
            ) : (
              <p className={styles.empty}>
                Select a Fixture to edit it. Shift or Ctrl click to select several.
              </p>
            )}
          </SidePanel>
          <AddFixtureDialog
            open={adding}
            onOpenChange={setAdding}
            patch={patch}
            profiles={entries.map((e) => e.profile)}
            onAdd={async (fixture) => {
              const added = await change({ type: 'putFixture', fixture });
              if (added) setSelection(selectFixture({ ids: [] }, fixture.id, [], {}));
              return added;
            }}
          />
        </div>
      ) : (
        <RigSetup
          patch={patch}
          outputs={outputs}
          onStage={(stage) => void change({ type: 'setStage', stage })}
          onAddUniverse={(universe) => change({ type: 'addUniverse', universe })}
          onPutUniverse={(universe) => void change({ type: 'putUniverse', universe })}
          onRemoveUniverse={(number) => void removeUniverse(number)}
        />
      )}
    </Tabs>
  );
}

// The beams of the moving Fixtures, as the engine sends them. Mounted only
// during the Focus Check, so the preview runs only then.
function FocusCheckBeams({ patch }: { patch: VenuePatch }) {
  return <BeamLines patch={patch} lights={usePreview()} />;
}

function names(fixtures: PatchedFixture[]): string[] {
  return fixtures.map((f) => f.name);
}
