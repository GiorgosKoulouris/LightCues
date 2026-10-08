import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ROLES, type Role } from '../../../shared/fixture-profile';
import {
  fixtureZone,
  patchProfile,
  putFixtures,
  suggestZone,
  ZONE_COLUMNS,
  ZONE_LEVELS,
  ZONE_ROWS,
  type PatchedFixture,
  type VenuePatch,
  type Zone,
  zoneName,
} from '../../../shared/venue-patch';
import { Button } from '../ui/Button';
import { NumberField, parseName, TextField } from '../ui/fields';
import { plural } from '../ui/plural';
import { Select, type SelectOption } from '../ui/Select';
import styles from './FixtureInspector.module.css';
import { MIXED, modeOptions, parseAddress, shared, universeOptions, zoneKey } from './fixtures';

// Arrow Up/Down step of a position, in metres.
const POSITION_STEP = 0.05;

// Role and Zone select values meaning "no override".
const PROFILE_ROLE = 'profile';
const SUGGESTED_ZONE = 'suggested';
type RoleChoice = Role | typeof PROFILE_ROLE;

// Every Zone on the stage grid, by select value.
const ZONES = new Map<string, Zone>(
  ZONE_LEVELS.flatMap((level) =>
    ZONE_ROWS.flatMap((row) =>
      ZONE_COLUMNS.map((column) => {
        const zone = { row, column, level };
        return [zoneKey(zone), zone] as const;
      }),
    ),
  ),
);

// The select fields whose change can make a Fixture not fit, such as a wider
// mode overlapping the next Fixture. Their errors show below them.
type CheckedField = 'mode' | 'universe';

interface FixtureInspectorProps {
  patch: VenuePatch;
  // The selected Fixtures, at least one.
  fixtures: PatchedFixture[];
  // Every change is sent at once, as one edit however many Fixtures it
  // changes.
  onPut(fixtures: PatchedFixture[]): void;
  onRemove(): void;
}

// Edits the selected Fixture, or the fields several selected Fixtures share:
// Role, Zone and Universe. A field the selected Fixtures differ in shows
// Mixed. A choice that does not fit is not sent; its error shows inline.
export function FixtureInspector({ patch, fixtures, onPut, onRemove }: FixtureInspectorProps) {
  const [errors, setErrors] = useState<Partial<Record<CheckedField, string>>>({});
  // The Fixture, when only one is selected.
  const single = fixtures.length === 1 ? fixtures[0] : undefined;

  // Checks a change against the patch first, as the engine would.
  function put(next: PatchedFixture[], field?: CheckedField) {
    const result = putFixtures(patch, next);
    if ('errors' in result && field) {
      setErrors({ [field]: result.errors.join(' ') });
      return;
    }
    setErrors({});
    onPut(next);
  }
  const putAll = (change: (fixture: PatchedFixture) => PatchedFixture, field?: CheckedField) =>
    put(fixtures.map(change), field);

  return (
    <section aria-label="Fixture inspector" className={styles.inspector}>
      <header className={styles.header}>
        <h3 className={styles.heading}>{single ? single.name : `${fixtures.length} Fixtures`}</h3>
        <span className={styles.subheading}>
          {single ? profileName(patch, single) : 'Changes apply to every selected Fixture.'}
        </span>
      </header>
      {single && (
        <SingleFields
          patch={patch}
          fixture={single}
          modeError={errors.mode}
          onPut={(fixture, field) => put([fixture], field)}
        />
      )}
      <div className={styles.fields}>
        <Select
          label="Universe"
          error={errors.universe}
          value={shared(fixtures.map((f) => String(f.universe)))}
          options={withMixed(fixtures, universeOptions(patch))}
          onChange={(universe) => {
            if (universe !== MIXED)
              putAll((f) => ({ ...f, universe: Number(universe) }), 'universe');
          }}
        />
        <Select<RoleChoice | typeof MIXED>
          label="Role"
          value={shared(fixtures.map((f) => f.role ?? PROFILE_ROLE))}
          options={withMixed<RoleChoice>(fixtures, [
            {
              value: PROFILE_ROLE,
              label: single
                ? `Profile default (${patchProfile(patch, single).defaultRole})`
                : 'Profile default',
            },
            ...ROLES.map((role) => ({ value: role, label: role })),
          ])}
          onChange={(role) => {
            if (role !== MIXED) putAll((f) => withRole(f, role));
          }}
        />
        <Select
          label="Zone"
          value={shared(fixtures.map((f) => (f.zone ? zoneKey(f.zone) : SUGGESTED_ZONE)))}
          options={withMixed(fixtures, [
            {
              value: SUGGESTED_ZONE,
              label: single
                ? `Suggested (${zoneName(suggestZone(patch.stage, single))})`
                : 'Suggested from position',
            },
            ...[...ZONES].map(([key, zone]) => ({ value: key, label: zoneName(zone) })),
          ])}
          onChange={(key) => {
            if (key !== MIXED) putAll((f) => withZone(f, ZONES.get(key)));
          }}
        />
        {single && (
          <p className={styles.note}>
            In {zoneName(fixtureZone(patch, single))}
            {single.zone && ' (override)'}
          </p>
        )}
      </div>
      <Button variant="danger" icon={<Trash2 />} className={styles.remove} onClick={onRemove}>
        {single ? 'Remove Fixture' : `Remove ${plural(fixtures.length, 'Fixture')}`}
      </Button>
    </section>
  );
}

// Name, mode, address and position: the fields only one Fixture is edited in.
function SingleFields({
  patch,
  fixture,
  modeError,
  onPut,
}: {
  patch: VenuePatch;
  fixture: PatchedFixture;
  modeError: string | undefined;
  onPut(fixture: PatchedFixture, field?: CheckedField): void;
}) {
  return (
    <div className={styles.fields}>
      <TextField
        label="Name"
        value={fixture.name}
        parse={parseName}
        onCommit={(name) => onPut({ ...fixture, name })}
      />
      <Select
        label="Mode"
        error={modeError}
        value={fixture.mode}
        options={modeOptions(patchProfile(patch, fixture))}
        onChange={(mode) => onPut({ ...fixture, mode }, 'mode')}
      />
      <TextField
        label="Address"
        mono
        value={fixture.address}
        parse={(text) => parseAddress(patch, fixture, text)}
        onCommit={(address) => onPut({ ...fixture, address })}
      />
      <div className={styles.position}>
        <NumberField
          label="x (m)"
          value={fixture.x}
          integer={false}
          step={POSITION_STEP}
          onCommit={(x) => onPut({ ...fixture, x })}
        />
        <NumberField
          label="y (m)"
          value={fixture.y}
          integer={false}
          step={POSITION_STEP}
          onCommit={(y) => onPut({ ...fixture, y })}
        />
        <NumberField
          label="Height (m)"
          value={fixture.height}
          min={0}
          integer={false}
          step={POSITION_STEP}
          onCommit={(height) => onPut({ ...fixture, height })}
        />
      </div>
    </div>
  );
}

function profileName(patch: VenuePatch, fixture: PatchedFixture): string {
  const { manufacturer, model } = patchProfile(patch, fixture);
  return `${manufacturer} ${model}`;
}

// Lists Mixed, disabled, when several Fixtures are selected.
function withMixed<V extends string>(
  fixtures: PatchedFixture[],
  options: SelectOption<V>[],
): SelectOption<V | typeof MIXED>[] {
  return fixtures.length > 1
    ? [{ value: MIXED, label: 'Mixed', disabled: true }, ...options]
    : options;
}

function withRole(fixture: PatchedFixture, role: RoleChoice): PatchedFixture {
  const next = { ...fixture };
  if (role === PROFILE_ROLE) delete next.role;
  else next.role = role;
  return next;
}

// Without a Zone, the Fixture's Zone follows its position.
function withZone(fixture: PatchedFixture, zone: Zone | undefined): PatchedFixture {
  const next = { ...fixture };
  if (zone) next.zone = zone;
  else delete next.zone;
  return next;
}
