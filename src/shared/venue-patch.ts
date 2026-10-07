// The Venue Patch model: the per-venue rig. Shared because the engine runs it
// and the editor shows it.
//
// Stage coordinates are metres. x runs from the centre line, positive toward
// Stage Left (the audience's right). y runs from the downstage edge, positive
// upstage; y < 0 is in front of the stage. height is above the stage floor.
import { ROLES, type FixtureMode, type FixtureProfile, type Role } from './fixture-profile';

export const ZONE_ROWS = ['Front', 'Downstage', 'Midstage', 'Upstage'] as const;
export type ZoneRow = (typeof ZONE_ROWS)[number];

export const ZONE_COLUMNS = ['Stage Right', 'Centre', 'Stage Left'] as const;
export type ZoneColumn = (typeof ZONE_COLUMNS)[number];

export const ZONE_LEVELS = ['Floor', 'Overhead'] as const;
export type ZoneLevel = (typeof ZONE_LEVELS)[number];

export interface Zone {
  row: ZoneRow;
  column: ZoneColumn;
  level: ZoneLevel;
}

// Fixtures at or above this height are suggested Overhead.
export const OVERHEAD_HEIGHT = 2;

const DMX_CHANNELS = 512;

export interface StageBounds {
  width: number;
  depth: number;
}

export interface StagePosition {
  x: number;
  y: number;
  height: number;
}

const ON_STAGE_ROWS = ['Downstage', 'Midstage', 'Upstage'] as const;

// The Zone a Fixture at `position` is physically in. The stage splits into
// thirds across and in depth; anything in front of it is the Front row. A
// position on a boundary goes upstage or toward Stage Left; one outside the
// stage goes to the nearest cell.
export function suggestZone(stage: StageBounds, { x, y, height }: StagePosition): Zone {
  const column = ZONE_COLUMNS[third(x + stage.width / 2, stage.width)];
  const row = y < 0 ? 'Front' : ON_STAGE_ROWS[third(y, stage.depth)];
  const level = height >= OVERHEAD_HEIGHT ? 'Overhead' : 'Floor';
  return { row, column, level };
}

// 0, 1 or 2: which third of [0, size] `offset` falls in, clamped. The small
// tolerance keeps a position on a boundary from falling short through
// floating-point error.
function third(offset: number, size: number): 0 | 1 | 2 {
  const index = Math.floor((offset / size) * 3 + 1e-9);
  return index <= 0 ? 0 : index >= 2 ? 2 : 1;
}

// One independent set of 512 DMX channels. `output` names the Output it is
// sent to; absent when unmapped.
export interface Universe {
  number: number;
  output?: string;
}

export interface PatchedFixture extends StagePosition {
  // Unique in the patch.
  id: string;
  name: string;
  // An embedded Profile and one of its modes.
  profileId: string;
  mode: string;
  universe: number;
  // 1-based start address.
  address: number;
  // Overrides of the Profile's default Role and the suggested Zone.
  role?: Role;
  zone?: Zone;
}

export interface VenuePatch {
  stage: StageBounds;
  universes: Universe[];
  fixtures: PatchedFixture[];
  // Copies of the Profiles the Fixtures use, so the patch does not depend on
  // the Profile Library.
  profiles: FixtureProfile[];
}

export type PatchResult = { patch: VenuePatch } | { errors: string[] };

// A new patch with one unmapped Universe.
export function emptyPatch(stage: StageBounds): VenuePatch {
  return { stage, universes: [{ number: 1 }], fixtures: [], profiles: [] };
}

// Adds a Fixture, or replaces the one with the same id. A Profile the patch
// already embeds is kept as is; otherwise `profile` is embedded.
export function putFixture(
  patch: VenuePatch,
  fixture: PatchedFixture,
  profile?: FixtureProfile,
): PatchResult {
  if (profile && profile.id !== fixture.profileId) {
    return {
      errors: [
        `"${fixture.name}": Profile "${profile.id}" given for Profile "${fixture.profileId}"`,
      ],
    };
  }
  const embedded = patch.profiles.some((p) => p.id === fixture.profileId);
  const profiles = embedded || !profile ? patch.profiles : [...patch.profiles, profile];
  const replaced = patch.fixtures.some((f) => f.id === fixture.id);
  const fixtures = replaced
    ? patch.fixtures.map((f) => (f.id === fixture.id ? fixture : f))
    : [...patch.fixtures, fixture];
  return validated(dropUnusedProfiles({ ...patch, fixtures, profiles }));
}

// Places a Fixture at `position`. Its Zone follows the new position unless it
// has a Zone override.
export function moveFixture(patch: VenuePatch, id: string, position: StagePosition): PatchResult {
  const fixture = patch.fixtures.find((f) => f.id === id);
  if (!fixture) return { errors: [`Fixture id "${id}" is not in the patch`] };
  const { x, y, height } = position;
  return putFixture(patch, { ...fixture, x, y, height });
}

export function removeFixture(patch: VenuePatch, id: string): VenuePatch {
  return dropUnusedProfiles({ ...patch, fixtures: patch.fixtures.filter((f) => f.id !== id) });
}

export function setStage(patch: VenuePatch, stage: StageBounds): PatchResult {
  return validated({ ...patch, stage });
}

// Adds a Universe, or replaces the one with the same number. Universes are
// kept in number order.
export function putUniverse(patch: VenuePatch, universe: Universe): PatchResult {
  const others = patch.universes.filter((u) => u.number !== universe.number);
  const universes = [...others, universe].sort((a, b) => a.number - b.number);
  return validated({ ...patch, universes });
}

// Adds a Universe whose number is not in the patch yet. Unlike putUniverse,
// it never replaces one.
export function addUniverse(patch: VenuePatch, universe: Universe): PatchResult {
  if (patch.universes.some((u) => u.number === universe.number)) {
    return { errors: [`Universe ${universe.number} is already in the patch`] };
  }
  return putUniverse(patch, universe);
}

// The lowest Universe number not in the patch.
export function freeUniverseNumber(patch: VenuePatch): number {
  let number = 1;
  while (patch.universes.some((u) => u.number === number)) number++;
  return number;
}

export function fixturesInUniverse(patch: VenuePatch, number: number): PatchedFixture[] {
  return patch.fixtures.filter((f) => f.universe === number);
}

// Removes a Universe together with its Fixtures.
export function removeUniverse(patch: VenuePatch, number: number): VenuePatch {
  return dropUnusedProfiles({
    ...patch,
    universes: patch.universes.filter((u) => u.number !== number),
    fixtures: patch.fixtures.filter((f) => f.universe !== number),
  });
}

function dropUnusedProfiles(patch: VenuePatch): VenuePatch {
  const used = new Set(patch.fixtures.map((f) => f.profileId));
  return { ...patch, profiles: patch.profiles.filter((p) => used.has(p.id)) };
}

function validated(patch: VenuePatch): PatchResult {
  const errors = validatePatch(patch);
  return errors.length > 0 ? { errors } : { patch };
}

// Checks a whole patch. Returns readable errors; an empty list means it is
// valid.
export function validatePatch(patch: VenuePatch): string[] {
  const { width, depth } = patch.stage;
  const errors = width > 0 && depth > 0 ? [] : ['Stage width and depth must be greater than 0'];
  errors.push(...validateUniverses(patch.universes));
  const placed: { fixture: PatchedFixture; first: number; last: number }[] = [];
  for (const fixture of patch.fixtures) {
    const problem = fixtureProblem(patch, fixture);
    if (problem) {
      errors.push(`"${fixture.name}": ${problem}`);
      continue;
    }
    const first = fixture.address;
    const last = first + fixtureMode(patch, fixture).channels.length - 1;
    if (last > DMX_CHANNELS) {
      errors.push(
        `"${fixture.name}" (${span(fixture.universe, first, last)}) runs past channel ${DMX_CHANNELS}`,
      );
    }
    for (const other of placed) {
      if (
        other.fixture.universe === fixture.universe &&
        other.first <= last &&
        first <= other.last
      ) {
        errors.push(
          `"${fixture.name}" (${span(fixture.universe, first, last)}) overlaps ` +
            `"${other.fixture.name}" (${span(other.fixture.universe, other.first, other.last)})`,
        );
      }
    }
    placed.push({ fixture, first, last });
  }
  for (const id of duplicates(patch.fixtures.map((f) => f.id))) {
    errors.push(`Fixture id "${id}" is used twice`);
  }
  for (const id of duplicates(patch.profiles.map((p) => p.id))) {
    errors.push(`Profile "${id}" is embedded twice`);
  }
  return errors;
}

function validateUniverses(universes: Universe[]): string[] {
  const errors: string[] = [];
  const byOutput = new Map<string, number>();
  for (const number of duplicates(universes.map((u) => u.number))) {
    errors.push(`Universe ${number} is listed twice`);
  }
  for (const { number, output } of universes) {
    if (!Number.isInteger(number) || number < 1) {
      errors.push(`Universe ${number}: number must be a whole number from 1`);
    }
    if (output === undefined) continue;
    const other = byOutput.get(output);
    if (other === undefined) byOutput.set(output, number);
    else errors.push(`Universes ${other} and ${number} are both mapped to Output "${output}"`);
  }
  return errors;
}

// Why a Fixture cannot be placed in its Universe, if it cannot.
function fixtureProblem(patch: VenuePatch, fixture: PatchedFixture): string | undefined {
  const { universe, profileId, mode, address, x, y, height, role, zone } = fixture;
  if (![x, y, height].every(Number.isFinite)) return 'x, y and height must be numbers';
  if (role !== undefined && !ROLES.includes(role)) return `Role "${role}" is not a Role`;
  if (zone !== undefined && !isZone(zone)) {
    return `Zone ${zone.row}/${zone.column}/${zone.level} is not on the stage grid`;
  }
  if (!patch.universes.some((u) => u.number === universe)) {
    return `Universe ${universe} is not in the patch`;
  }
  const profile = patch.profiles.find((p) => p.id === profileId);
  if (!profile) return `Profile "${profileId}" is not in the patch`;
  const channels = profile.modes.find((m) => m.name === mode)?.channels;
  if (!channels) return `mode "${mode}" is not in Profile "${profileId}"`;
  if (channels.length === 0) return `mode "${mode}" has no channels`;
  if (!Number.isInteger(address) || address < 1 || address > DMX_CHANNELS) {
    return `address must be a whole number from 1 to ${DMX_CHANNELS}`;
  }
  return undefined;
}

function isZone({ row, column, level }: Zone): boolean {
  return ZONE_ROWS.includes(row) && ZONE_COLUMNS.includes(column) && ZONE_LEVELS.includes(level);
}

// Universe.address notation, e.g. 1.1–1.3.
function span(universe: number, first: number, last: number): string {
  return `${universe}.${first}–${universe}.${last}`;
}

export function fixtureZone(patch: VenuePatch, fixture: PatchedFixture): Zone {
  return fixture.zone ?? suggestZone(patch.stage, fixture);
}

export function fixtureRole(patch: VenuePatch, fixture: PatchedFixture): Role {
  return fixture.role ?? patchProfile(patch, fixture).defaultRole;
}

// The embedded Profile of a patched Fixture.
export function patchProfile(patch: VenuePatch, fixture: PatchedFixture): FixtureProfile {
  const profile = patch.profiles.find((p) => p.id === fixture.profileId);
  if (!profile) throw new Error(`Profile "${fixture.profileId}" is not in the patch`);
  return profile;
}

// The Profile mode a patched Fixture is in.
export function fixtureMode(patch: VenuePatch, fixture: PatchedFixture): FixtureMode {
  const mode = patchProfile(patch, fixture).modes.find((m) => m.name === fixture.mode);
  if (!mode) throw new Error(`Mode "${fixture.mode}" is not in Profile "${fixture.profileId}"`);
  return mode;
}

function duplicates<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const repeated = new Set<T>();
  for (const value of values) (seen.has(value) ? repeated : seen).add(value);
  return [...repeated];
}
