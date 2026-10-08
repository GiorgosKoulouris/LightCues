// Fixture list logic for the Venue Patch view: search, grouping and
// multi-select.
import type { FixtureProfile } from '../../../shared/fixture-profile';
import {
  addressProblem,
  DMX_CHANNELS,
  fixturesInUniverse,
  fixtureZone,
  lastChannel,
  patchProfile,
  ZONE_COLUMNS,
  ZONE_LEVELS,
  ZONE_ROWS,
  type PatchedFixture,
  type VenuePatch,
  type Zone,
  zoneName,
} from '../../../shared/venue-patch';
import { parseNumber, type ParseResult } from '../ui/fields';
import type { SelectModifiers } from '../ui/List';
import type { SelectOption } from '../ui/Select';
import { matchesQuery } from '../ui/search';

export type Grouping = 'universe' | 'zone';

// What the Fixture list shows: a search and how it is grouped.
export interface FixtureFilter {
  query: string;
  grouping: Grouping;
}

// Universe.address, as DMX addresses are written: 1.17.
export function addressLabel({ universe, address }: PatchedFixture): string {
  return `${universe}.${address}`;
}

// Fixtures whose name, Profile or address contains every word of `query`.
export function filterFixtures(patch: VenuePatch, query: string): PatchedFixture[] {
  return patch.fixtures.filter((fixture) => {
    const { manufacturer, model } = patchProfile(patch, fixture);
    return matchesQuery(`${fixture.name} ${manufacturer} ${model} ${addressLabel(fixture)}`, query);
  });
}

// By Universe: in address order. By Zone: Floor before Overhead, front to
// back, Stage Right to Stage Left, then by address.
export function sortFixtures(
  patch: VenuePatch,
  fixtures: PatchedFixture[],
  by: Grouping,
): PatchedFixture[] {
  const byAddress = (a: PatchedFixture, b: PatchedFixture) =>
    a.universe - b.universe || a.address - b.address;
  if (by === 'universe') return fixtures.toSorted(byAddress);
  const rank = (fixture: PatchedFixture) => zoneRank(fixtureZone(patch, fixture));
  return fixtures.toSorted((a, b) => rank(a) - rank(b) || byAddress(a, b));
}

function zoneRank({ row, column, level }: Zone): number {
  return (
    (ZONE_LEVELS.indexOf(level) * ZONE_ROWS.length + ZONE_ROWS.indexOf(row)) * ZONE_COLUMNS.length +
    ZONE_COLUMNS.indexOf(column)
  );
}

// The heading a Fixture is listed under.
export function fixtureGroup(patch: VenuePatch, fixture: PatchedFixture, by: Grouping): string {
  return by === 'universe' ? `Universe ${fixture.universe}` : zoneName(fixtureZone(patch, fixture));
}

// The address after the last Fixture in a Universe. A suggestion: the engine
// still rejects it if the Fixture does not fit.
export function nextAddress(patch: VenuePatch, universe: number): number {
  const ends = fixturesInUniverse(patch, universe).map((f) => lastChannel(patch, f) + 1);
  return Math.max(1, ...ends);
}

// Parses an address typed for `fixture`, which must fit in its Universe.
// `patch` must embed the Fixture's Profile.
export function parseAddress(
  patch: VenuePatch,
  fixture: PatchedFixture,
  text: string,
): ParseResult<number> {
  const number = parseNumber(text, { min: 1, max: DMX_CHANNELS });
  if (!number.ok) return number;
  const problem = addressProblem(patch, { ...fixture, address: number.value });
  return problem ? { ok: false, error: problem } : number;
}

export function modeOptions(profile: FixtureProfile): SelectOption<string>[] {
  return profile.modes.map((m) => ({
    value: m.name,
    label: `${m.name} (${m.channels.length} ch)`,
  }));
}

export function universeOptions(patch: VenuePatch): SelectOption<string>[] {
  return patch.universes.map((u) => ({ value: String(u.number), label: String(u.number) }));
}

export interface Selection {
  ids: string[];
  // Where a Shift range starts: the last Fixture clicked without Shift.
  anchor?: string;
  // The last Fixture clicked or reached with the arrow keys, which they move
  // on from.
  current?: string;
}

// The selection after clicking Fixture `id`. `order` is the list order, which
// a Shift range follows from the anchor; Ctrl adds or removes one Fixture, or
// adds the range.
export function selectFixture(
  selection: Selection,
  id: string,
  order: readonly string[],
  { range = false, toggle = false }: Partial<SelectModifiers>,
): Selection {
  const from = selection.anchor === undefined ? -1 : order.indexOf(selection.anchor);
  const to = order.indexOf(id);
  if (range && from >= 0 && to >= 0) {
    const span = order.slice(Math.min(from, to), Math.max(from, to) + 1);
    const ids = toggle ? [...selection.ids.filter((i) => !span.includes(i)), ...span] : span;
    return { ids, anchor: selection.anchor, current: id };
  }
  if (toggle) {
    const ids = selection.ids.includes(id)
      ? selection.ids.filter((i) => i !== id)
      : [...selection.ids, id];
    return { ids, anchor: id, current: id };
  }
  return { ids: [id], anchor: id, current: id };
}

// A bulk-edited field whose value differs between the selected Fixtures.
export const MIXED = 'mixed';

// The value every one of `values` has, or MIXED.
export function shared<T>(values: readonly T[]): T | typeof MIXED {
  const [first] = values;
  return values.every((value) => value === first) ? (first as T) : MIXED;
}

// A Zone as a select value.
export function zoneKey({ row, column, level }: Zone): string {
  return `${row}|${column}|${level}`;
}
