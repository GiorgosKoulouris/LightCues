import type { Capability, Channel, FixtureMode, FixtureProfile } from '../shared/fixture-profile';

// Checks a hand-made or edited Profile before it enters the Profile Library.
// Returns readable errors; an empty list means the Profile is valid.
export function validateProfile(profile: FixtureProfile): string[] {
  const errors: string[] = [];
  if (!profile.id.trim()) errors.push('Id is required');
  if (!profile.manufacturer.trim()) errors.push('Manufacturer is required');
  if (!profile.model.trim()) errors.push('Model is required');
  if (profile.modes.length === 0) errors.push('At least one mode is required');
  for (const name of duplicates(profile.modes.map((m) => m.name))) {
    errors.push(`Mode name "${name}" is used twice`);
  }
  for (const mode of profile.modes) errors.push(...validateMode(mode));
  return errors;
}

function validateMode(mode: FixtureMode): string[] {
  const errors: string[] = [];
  if (!mode.name.trim()) errors.push('Every mode needs a name');
  if (mode.channels.length === 0) errors.push(`Mode "${mode.name}" has no channels`);

  const named = mode.channels.filter((c) => c.kind !== 'unused');
  for (const name of duplicates(named.map((c) => c.name))) {
    errors.push(`Mode "${mode.name}": channel name "${name}" is used twice`);
  }
  const controls = new Set(named.filter((c) => c.kind === 'control').map((c) => c.name));
  mode.channels.forEach((channel, index) => {
    if (channel.kind === 'unused') return;
    const where = `Mode "${mode.name}", channel ${index + 1} "${channel.name}"`;
    for (const error of validateChannel(channel, controls)) errors.push(`${where}: ${error}`);
  });
  return errors;
}

function validateChannel(
  channel: Exclude<Channel, { kind: 'unused' }>,
  controls: Set<string>,
): string[] {
  const errors: string[] = [];
  if (!channel.name.trim()) errors.push('name is required');
  if (!isDmxValue(channel.defaultValue)) {
    errors.push('default value must be a whole number from 0 to 255');
  }
  if (channel.kind === 'fine') {
    if (!controls.has(channel.of)) {
      errors.push(`fine channel of "${channel.of}", which is not in this mode`);
    }
    if (channel.byte !== 1 && channel.byte !== 2) errors.push('fine byte must be 1 or 2');
    return errors;
  }

  if (channel.ranges.length === 0) errors.push('at least one range is required');
  const sorted = [...channel.ranges].sort((a, b) => a.from - b.from);
  for (const range of sorted) {
    if (!isDmxValue(range.from) || !isDmxValue(range.to) || range.from > range.to) {
      errors.push(`range ${range.from}–${range.to} must run from low to high within 0–255`);
    }
    errors.push(...validateCapability(range.capability));
  }
  sorted.forEach((range, i) => {
    const next = sorted[i + 1];
    if (next && next.from <= range.to) {
      errors.push(`ranges ${range.from}–${range.to} and ${next.from}–${next.to} overlap`);
    }
  });
  return errors;
}

function validateCapability(capability: Capability): string[] {
  if (capability.type === 'wheelSlot' && !/^#[0-9a-f]{6}$/i.test(capability.slot.colour)) {
    return [`wheel slot "${capability.slot.name}" colour must be #rrggbb`];
  }
  return [];
}

function isDmxValue(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function duplicates(names: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const name of names) (seen.has(name) ? repeated : seen).add(name);
  return [...repeated];
}
