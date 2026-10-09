// Pure helpers for the Profile Library view: search, order and summaries.
import type { FixtureProfile } from '../../../shared/fixture-profile';
import type { ProfileLibraryEntry, SkippedProfile } from '../../../shared/protocol';
import { profileName } from '../../../shared/profile-edit';
import { plural } from '../ui/plural';
import { matchesQuery } from '../ui/search';

// Entries whose manufacturer and model contain every word of `query`.
export function filterProfiles(
  entries: readonly ProfileLibraryEntry[],
  query: string,
): ProfileLibraryEntry[] {
  return entries.filter(({ profile }) => matchesQuery(profileName(profile), query));
}

// "1 mode · 16ch", "2 modes · 3–6ch".
export function modeSummary(profile: FixtureProfile): string {
  const counts = profile.modes.map((mode) => mode.channels.length);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const channels = counts.length === 0 ? '' : min === max ? ` · ${min}ch` : ` · ${min}–${max}ch`;
  return `${plural(counts.length, 'mode')}${channels}`;
}

// Whether two Profiles are the same, whatever the order of their keys. A key
// set to undefined counts as absent, as it does once saved as JSON.
export function sameProfile(a: FixtureProfile, b: FixtureProfile): boolean {
  return sameValue(a, b);
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const keys = new Set([...definedKeys(aRecord), ...definedKeys(bRecord)]);
  return [...keys].every((key) => sameValue(aRecord[key], bRecord[key]));
}

function definedKeys(record: Record<string, unknown>): string[] {
  return Object.keys(record).filter((key) => record[key] !== undefined);
}

// A skipped Profile as listed before an import: "Profile 3, Acme Par: <error>",
// counting from 1.
export function skippedProfileLabel({ index, manufacturer, model, error }: SkippedProfile): string {
  const name = [manufacturer, model].filter((part) => part !== undefined).join(' ');
  return `Profile ${index + 1}${name ? `, ${name}` : ''}: ${error}`;
}

// "LightCues Profiles 2026-10-09.lclibrary", by the local date.
export function libraryFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `LightCues Profiles ${day}.lclibrary`;
}
