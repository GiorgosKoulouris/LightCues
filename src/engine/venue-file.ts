import { validatePatch, type VenuePatch } from '../shared/venue-patch';

// The .lcvenue file: a Venue Patch as versioned JSON. The patch embeds its
// Profiles, so a file opens without the Profile Library.

const VERSION = 1;

interface VenueFile extends VenuePatch {
  version: number;
}

export function saveVenueFile(patch: VenuePatch): string {
  const file: VenueFile = { version: VERSION, ...patch };
  return JSON.stringify(file);
}

// Throws when the file is of an unknown version or its patch is invalid.
export function loadVenueFile(json: string): VenuePatch {
  const { version, ...patch } = JSON.parse(json) as VenueFile;
  if (version !== VERSION) throw new Error(`Unsupported Venue Patch version: ${version}`);
  if (!hasParts(patch)) {
    throw new Error('Invalid Venue Patch: stage, universes, fixtures and profiles are required');
  }
  const errors = validatePatch(patch);
  if (errors.length > 0) throw new Error(['Invalid Venue Patch:', ...errors].join('\n'));
  return patch;
}

function hasParts(patch: Partial<VenuePatch>): boolean {
  const { stage, universes, fixtures, profiles } = patch;
  return (
    typeof stage === 'object' &&
    stage !== null &&
    [universes, fixtures, profiles].every(Array.isArray)
  );
}
