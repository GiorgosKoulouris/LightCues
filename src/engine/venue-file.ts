import { validatePatch, type VenuePatch } from '../shared/venue-patch';

// The .lcvenue file: a Venue Patch as versioned JSON. The patch embeds its
// Profiles, so a file opens without the Profile Library.

const VERSION = 1;

interface VenueFile extends VenuePatch {
  version: number;
}

// Throws when the patch is invalid, so every saved file loads.
export function saveVenueFile(patch: VenuePatch): string {
  throwIfInvalid(validatePatch(patch));
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
  throwIfInvalid(validatePatch(patch));
  return patch;
}

function throwIfInvalid(errors: string[]): void {
  if (errors.length > 0) throw new Error(['Invalid Venue Patch:', ...errors].join('\n'));
}

function hasParts(patch: Partial<VenuePatch>): boolean {
  const { stage, universes, fixtures, profiles } = patch;
  return (
    typeof stage === 'object' &&
    stage !== null &&
    [universes, fixtures, profiles].every(Array.isArray)
  );
}
