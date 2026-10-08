import { Plus } from 'lucide-react';
import type { Ref } from 'react';
import { fixtureRole, type PatchedFixture, type VenuePatch } from '../../../shared/venue-patch';
import { FIND_SHORTCUT } from '../shell/shortcuts';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { SearchField } from '../ui/fields';
import { List, type SelectModifiers } from '../ui/List';
import styles from './FixtureList.module.css';
import {
  addressLabel,
  fixtureGroup,
  type FixtureFilter,
  type Grouping,
  type Selection,
} from './fixtures';

const GROUPINGS: { value: Grouping; label: string }[] = [
  { value: 'universe', label: 'Universe' },
  { value: 'zone', label: 'Zone' },
];

interface FixtureListProps {
  patch: VenuePatch;
  // The Fixtures the search leaves, sorted for `grouping`.
  fixtures: PatchedFixture[];
  filter: FixtureFilter;
  selection: Selection;
  searchRef: Ref<HTMLInputElement>;
  onFilter(filter: FixtureFilter): void;
  onSelect(id: string, modifiers: SelectModifiers): void;
  onRemove(): void;
  onAdd(): void;
}

// The patch's Fixtures, searched and grouped by Universe or Zone. Arrow keys
// select, Shift and Ctrl select several, Del removes the selected.
export function FixtureList({
  patch,
  fixtures,
  filter,
  selection,
  searchRef,
  onFilter,
  onSelect,
  onRemove,
  onAdd,
}: FixtureListProps) {
  return (
    <div className={styles.column}>
      <SearchField
        label="Search Fixtures"
        placeholder={`Search Fixtures (${FIND_SHORTCUT})`}
        inputRef={searchRef}
        value={filter.query}
        onChange={(query) => onFilter({ ...filter, query })}
      />
      <div role="group" aria-label="Group by" className={styles.grouping}>
        <span className={styles.groupingLabel}>Group by</span>
        {GROUPINGS.map(({ value, label }) => (
          <Button
            key={value}
            aria-pressed={filter.grouping === value}
            onClick={() => onFilter({ ...filter, grouping: value })}
          >
            {label}
          </Button>
        ))}
      </div>
      <List
        label="Fixtures"
        items={fixtures}
        getKey={(fixture) => fixture.id}
        selectedKey={selection.current}
        selectedKeys={selection.ids}
        onSelect={onSelect}
        group={(fixture) => fixtureGroup(patch, fixture, filter.grouping)}
        onDelete={onRemove}
        className={styles.list}
        empty={patch.fixtures.length === 0 ? 'No Fixtures yet' : 'No Fixtures match'}
        renderItem={(fixture) => (
          <>
            <span data-testid="name" className={styles.name}>
              {fixture.name}
            </span>
            <Badge className={styles.role}>{fixtureRole(patch, fixture)}</Badge>
            <span className={styles.address}>{addressLabel(fixture)}</span>
          </>
        )}
      />
      <Button icon={<Plus />} onClick={onAdd}>
        Add Fixture
      </Button>
    </div>
  );
}
