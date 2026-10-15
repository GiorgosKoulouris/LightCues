import {
  validatePatch,
  type House,
  type HouseSetting,
  type VenuePatch,
} from '../shared/venue-patch';

// The .lcvenue file: a Venue Patch as versioned JSON. The patch embeds its
// Profiles, so a file opens without the Profile Library.
//
// Version 2 adds each Fixture's optional Mounting. Version 3 adds the
// optional House: House Groups, House Lights, the Startup look and the house
// looks. Older files still load, without them.

const VERSION = 3;
const READABLE_VERSIONS = [1, 2, 3];

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
  if (!READABLE_VERSIONS.includes(version)) {
    throw new Error(`Unsupported Venue Patch version: ${version}`);
  }
  if (!hasParts(patch)) {
    throw new Error('Invalid Venue Patch: stage, universes, fixtures and profiles are required');
  }
  if (patch.house !== undefined && !isHouse(patch.house)) {
    throw new Error(
      'Invalid Venue Patch: a House needs groups, lights and a colour per house look setting',
    );
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

// The House's parts are there, so validatePatch can check them.
function isHouse(house: unknown): boolean {
  if (!isObject(house)) return false;
  const { groups, lights, startupLook, looks } = house as Partial<House>;
  return (
    [groups, lights].every(Array.isArray) &&
    (startupLook === undefined || isHouseLook(startupLook)) &&
    (looks === undefined || (isObject(looks) && Object.values(looks).every(isHouseLook)))
  );
}

function isHouseLook(look: unknown): boolean {
  return (
    isObject(look) &&
    Object.values(look as object).every(
      (setting) => isObject(setting) && isObject((setting as Partial<HouseSetting>).colour),
    )
  );
}

function isObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}
