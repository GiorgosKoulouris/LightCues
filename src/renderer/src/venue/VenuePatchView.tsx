import { useEffect, useState, type ReactNode } from 'react';
import { ROLES, type FixtureProfile, type Role } from '../../../shared/fixture-profile';
import {
  fixtureMode,
  fixturesInUniverse,
  fixtureZone,
  freeUniverseNumber,
  suggestZone,
  ZONE_COLUMNS,
  ZONE_LEVELS,
  ZONE_ROWS,
  type PatchedFixture,
  type StageBounds,
  type Universe,
  type VenuePatch,
  type Zone,
} from '../../../shared/venue-patch';
import { useProfileLibrary } from '../profiles/useProfileLibrary';
import { StagePlan, zoneName } from './StagePlan';
import { useVenuePatch } from './useVenuePatch';

// Edits the current Venue Patch: file, stage bounds, Universes and their
// Outputs, and Fixtures on a top-down stage plan.
export function VenuePatchView() {
  const { venue, edit, newVenue, open, save } = useVenuePatch();
  const { entries } = useProfileLibrary();
  const [selectedId, setSelectedId] = useState<string>();
  const [errors, setErrors] = useState<string[]>([]);

  // Save chosen when closing the window. Cancelling the file dialog keeps
  // the window open.
  useEffect(
    () =>
      window.closeGuard.onSaveBeforeClose(async () => {
        const result = await save().catch((error: Error) => [`Save failed: ${error.message}`]);
        if (result) setErrors(result);
        return result?.length === 0;
      }),
    [save],
  );

  if (!venue) return <p>Loading Venue Patch…</p>;
  const { patch, path, unsaved } = venue;
  const selected = patch.fixtures.find((f) => f.id === selectedId);

  // Runs a change and shows its errors, or clears them when it worked. A
  // change resolving to undefined was cancelled and leaves them.
  async function run(change: () => Promise<string[] | undefined>): Promise<boolean> {
    let result: string[] | undefined;
    try {
      result = await change();
    } catch (error) {
      result = [(error as Error).message];
    }
    if (result === undefined) return false;
    setErrors(result);
    return result.length === 0;
  }

  function discardUnsaved(): boolean {
    return !unsaved || window.confirm('The Venue Patch has unsaved changes. Discard them?');
  }

  function removeUniverse(number: number) {
    const fixtures = fixturesInUniverse(patch, number);
    if (
      fixtures.length > 0 &&
      !window.confirm(
        `Universe ${number} has ${fixtures.length} Fixture(s): ` +
          `${fixtures.map((f) => f.name).join(', ')}. Remove the Universe and its Fixtures?`,
      )
    ) {
      return;
    }
    void run(() => edit({ type: 'removeUniverse', number }));
  }

  return (
    <section>
      <h2>Venue Patch</h2>
      <p>
        {path ?? 'Not saved yet'}
        {unsaved && ' (unsaved changes)'}{' '}
        <button
          type="button"
          onClick={() => {
            if (!discardUnsaved()) return;
            newVenue();
            setSelectedId(undefined);
            setErrors([]);
          }}
        >
          New
        </button>
        <button
          type="button"
          onClick={() => {
            if (discardUnsaved()) void run(open);
          }}
        >
          Open…
        </button>
        <button type="button" onClick={() => void run(() => save())}>
          Save
        </button>
        <button type="button" onClick={() => void run(() => save({ as: true }))}>
          Save As…
        </button>
      </p>
      {errors.length > 0 && (
        <ul role="alert">
          {errors.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      <StageForm
        key={`${patch.stage.width}x${patch.stage.depth}`}
        stage={patch.stage}
        onApply={(stage) => void run(() => edit({ type: 'setStage', stage }))}
      />
      <UniverseList
        universes={patch.universes}
        patch={patch}
        onAdd={(universe) => run(() => edit({ type: 'addUniverse', universe }))}
        onPut={(universe) => void run(() => edit({ type: 'putUniverse', universe }))}
        onRemove={removeUniverse}
      />
      <AddFixtureForm
        patch={patch}
        profiles={entries.map((e) => e.profile)}
        onAdd={async (fixture) => {
          if (await run(() => edit({ type: 'putFixture', fixture }))) setSelectedId(fixture.id);
        }}
      />
      <div style={{ display: 'flex', gap: '1em', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 480px' }}>
          <StagePlan
            patch={patch}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={(id, position) => run(() => edit({ type: 'moveFixture', id, position }))}
          />
        </div>
        {selected && (
          <FixtureForm
            key={selected.id}
            patch={patch}
            fixture={selected}
            onApply={(fixture) => run(() => edit({ type: 'putFixture', fixture }))}
            onRemove={() => {
              if (!window.confirm(`Remove ${selected.name}?`)) return;
              setSelectedId(undefined);
              void run(() => edit({ type: 'removeFixture', id: selected.id }));
            }}
          />
        )}
      </div>
    </section>
  );
}

function StageForm({ stage, onApply }: { stage: StageBounds; onApply(stage: StageBounds): void }) {
  const [width, setWidth] = useState(String(stage.width));
  const [depth, setDepth] = useState(String(stage.depth));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply({ width: Number(width), depth: Number(depth) });
      }}
    >
      <h3>Stage</h3>
      <label>
        Width (m) <MetreInput value={width} onChange={setWidth} min={0.1} />
      </label>{' '}
      <label>
        Depth (m) <MetreInput value={depth} onChange={setDepth} min={0.1} />
      </label>{' '}
      <button type="submit">Apply</button>
    </form>
  );
}

function UniverseList({
  universes,
  patch,
  onAdd,
  onPut,
  onRemove,
}: {
  universes: Universe[];
  patch: VenuePatch;
  // Resolves to true when the Universe was added.
  onAdd(universe: Universe): Promise<boolean>;
  onPut(universe: Universe): void;
  onRemove(number: number): void;
}) {
  // What the user typed; until then, the lowest free number.
  const [typed, setTyped] = useState<string>();
  const number = typed ?? String(freeUniverseNumber(patch));
  return (
    <section>
      <h3>Universes</h3>
      <table>
        <thead>
          <tr>
            <th>Universe</th>
            <th>Output</th>
            <th>Fixtures</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {universes.map((universe) => (
            // Keyed by Output too, so the field resets when the patch is replaced.
            <tr key={`${universe.number}:${universe.output ?? ''}`}>
              <td>{universe.number}</td>
              <td>
                <OutputInput universe={universe} onPut={onPut} />
              </td>
              <td>{fixturesInUniverse(patch, universe.number).length}</td>
              <td>
                <button type="button" onClick={() => onRemove(universe.number)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onAdd({ number: Number(number) }).then((added) => {
            if (added) setTyped(undefined);
          });
        }}
      >
        <label>
          Universe{' '}
          <input
            type="number"
            min={1}
            step={1}
            value={number}
            onChange={(e) => setTyped(e.target.value)}
            style={{ width: '5em' }}
          />
        </label>{' '}
        <button type="submit">Add Universe</button>
      </form>
    </section>
  );
}

// Output ids are free text until Outputs can be discovered (issue 06). Blank
// is unmapped. Commits on blur or Enter.
function OutputInput({ universe, onPut }: { universe: Universe; onPut(u: Universe): void }) {
  const [value, setValue] = useState(universe.output ?? '');
  function commit() {
    const output = value.trim();
    if (output === (universe.output ?? '')) return;
    onPut(output ? { number: universe.number, output } : { number: universe.number });
  }
  return (
    <input
      value={value}
      placeholder="Unmapped"
      aria-label={`Output of Universe ${universe.number}`}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    />
  );
}

function AddFixtureForm({
  patch,
  profiles,
  onAdd,
}: {
  patch: VenuePatch;
  profiles: FixtureProfile[];
  onAdd(fixture: PatchedFixture): Promise<void>;
}) {
  // Profiles the patch embeds come first: adding one of them keeps the
  // patch's copy.
  const choices = [
    ...patch.profiles,
    ...profiles.filter((p) => !patch.profiles.some((e) => e.id === p.id)),
  ];
  const [profileId, setProfileId] = useState('');
  const [mode, setMode] = useState('');
  const profile = choices.find((p) => p.id === profileId) ?? choices[0];
  const modeName = profile?.modes.some((m) => m.name === mode) ? mode : profile?.modes[0]?.name;

  const universe = patch.universes[0]?.number;

  if (!profile || modeName === undefined) {
    return <p>Add a Profile to the Profile Library to patch Fixtures.</p>;
  }
  if (universe === undefined) return <p>Add a Universe to patch Fixtures.</p>;

  function add() {
    if (!profile || modeName === undefined || universe === undefined) return;
    const count = patch.fixtures.filter((f) => f.profileId === profile.id).length;
    void onAdd({
      id: crypto.randomUUID(),
      name: `${profile.model} ${count + 1}`,
      profileId: profile.id,
      mode: modeName,
      universe,
      address: nextAddress(patch, universe),
      x: 0,
      y: patch.stage.depth / 6,
      height: 0,
    });
  }

  return (
    <p>
      <label>
        Profile{' '}
        <select value={profile.id} onChange={(e) => setProfileId(e.target.value)}>
          {choices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.manufacturer} {p.model}
            </option>
          ))}
        </select>
      </label>{' '}
      <label>
        Mode{' '}
        <select value={modeName} onChange={(e) => setMode(e.target.value)}>
          {profile.modes.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name} ({m.channels.length} ch)
            </option>
          ))}
        </select>
      </label>{' '}
      <button type="button" onClick={add}>
        Add Fixture
      </button>
    </p>
  );
}

// The address after the last Fixture in a Universe. A suggestion: the engine
// still rejects it if the Fixture does not fit.
function nextAddress(patch: VenuePatch, universe: number): number {
  const ends = fixturesInUniverse(patch, universe).map(
    (f) => f.address + fixtureMode(patch, f).channels.length,
  );
  return Math.max(1, ...ends);
}

// A Role or Zone field value meaning "no override".
const SUGGESTED = '';

type FixtureDraft = ReturnType<typeof fixtureDraft>;

// The Fixture form's fields for a patched Fixture, as typed text.
function fixtureDraft(fixture: PatchedFixture) {
  return {
    name: fixture.name,
    mode: fixture.mode,
    universe: String(fixture.universe),
    address: String(fixture.address),
    x: String(fixture.x),
    y: String(fixture.y),
    height: String(fixture.height),
    role: fixture.role ?? SUGGESTED,
    zone: fixture.zone ? zoneKey(fixture.zone) : SUGGESTED,
  };
}

function FixtureForm({
  patch,
  fixture,
  onApply,
  onRemove,
}: {
  patch: VenuePatch;
  fixture: PatchedFixture;
  onApply(fixture: PatchedFixture): Promise<boolean>;
  onRemove(): void;
}) {
  // Only the fields the user changed, so the others follow the engine's
  // Fixture, e.g. its position after a drag.
  const [edits, setEdits] = useState<Partial<FixtureDraft>>({});
  const draft = { ...fixtureDraft(fixture), ...edits };
  const unapplied = Object.keys(edits).length > 0;
  const profile = patch.profiles.find((p) => p.id === fixture.profileId);
  const set = (change: Partial<FixtureDraft>) => setEdits((e) => ({ ...e, ...change }));
  const position = { x: Number(draft.x), y: Number(draft.y), height: Number(draft.height) };

  function apply() {
    const next: PatchedFixture = {
      ...fixture,
      name: draft.name,
      mode: draft.mode,
      universe: Number(draft.universe),
      address: Number(draft.address),
      ...position,
    };
    if (draft.role === SUGGESTED) delete next.role;
    else next.role = draft.role as Role;
    if (draft.zone === SUGGESTED) delete next.zone;
    else next.zone = parseZoneKey(draft.zone);
    void onApply(next).then((applied) => {
      if (applied) setEdits({});
    });
  }

  return (
    <form
      style={{ flex: '0 1 320px' }}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <h3>{fixture.name}</h3>
      <p>
        {profile ? `${profile.manufacturer} ${profile.model}` : fixture.profileId}
        <br />
        Zone: {zoneName(fixtureZone(patch, fixture))}
        {fixture.zone && ' (override)'}
      </p>
      <Field label="Name">
        <input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label="Mode">
        <select value={draft.mode} onChange={(e) => set({ mode: e.target.value })}>
          {profile?.modes.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name} ({m.channels.length} ch)
            </option>
          ))}
        </select>
      </Field>
      <Field label="Universe">
        <select value={draft.universe} onChange={(e) => set({ universe: e.target.value })}>
          {patch.universes.map((u) => (
            <option key={u.number} value={u.number}>
              {u.number}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Address">
        <input
          type="number"
          min={1}
          max={512}
          value={draft.address}
          onChange={(e) => set({ address: e.target.value })}
        />
      </Field>
      <Field label="x (m)">
        <MetreInput value={draft.x} onChange={(x) => set({ x })} />
      </Field>
      <Field label="y (m)">
        <MetreInput value={draft.y} onChange={(y) => set({ y })} />
      </Field>
      <Field label="Height (m)">
        <MetreInput value={draft.height} onChange={(height) => set({ height })} min={0} />
      </Field>
      <Field label="Role">
        <select value={draft.role} onChange={(e) => set({ role: e.target.value })}>
          <option value={SUGGESTED}>Profile default ({profile?.defaultRole})</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Zone">
        <select value={draft.zone} onChange={(e) => set({ zone: e.target.value })}>
          <option value={SUGGESTED}>
            Suggested ({zoneName(suggestZone(patch.stage, position))})
          </option>
          {ZONE_LEVELS.flatMap((level) =>
            ZONE_ROWS.flatMap((row) =>
              ZONE_COLUMNS.map((column) => {
                const key = zoneKey({ row, column, level });
                return (
                  <option key={key} value={key}>
                    {zoneName({ row, column, level })}
                  </option>
                );
              }),
            ),
          )}
        </select>
      </Field>
      <p>
        {unapplied && (
          <>
            Unapplied changes.
            <br />
          </>
        )}
        <button type="submit" disabled={!unapplied}>
          Apply
        </button>{' '}
        <button type="button" disabled={!unapplied} onClick={() => setEdits({})}>
          Revert
        </button>{' '}
        <button type="button" onClick={onRemove}>
          Remove Fixture
        </button>
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p style={{ margin: '0.3em 0' }}>
      <label>
        {label} {children}
      </label>
    </p>
  );
}

function MetreInput({
  value,
  onChange,
  min,
}: {
  value: string;
  onChange(value: string): void;
  min?: number;
}) {
  return (
    <input
      type="number"
      step={0.05}
      min={min}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: '6em' }}
    />
  );
}

function zoneKey({ row, column, level }: Zone): string {
  return `${row}|${column}|${level}`;
}

function parseZoneKey(key: string): Zone {
  const [row, column, level] = key.split('|') as [Zone['row'], Zone['column'], Zone['level']];
  return { row, column, level };
}
