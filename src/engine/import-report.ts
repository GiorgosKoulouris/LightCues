import type { Capability, FixtureProfile, UnsupportedFeature } from '../shared/fixture-profile';

// A fixture file read into a Profile.
export interface FixtureImport {
  profile: FixtureProfile;
  // Everything the Profile cannot represent. Never silently dropped.
  unsupported: UnsupportedFeature[];
}

// What a fixture import found that a Profile cannot represent.
export interface ImportReport {
  readonly features: UnsupportedFeature[];
  add(feature: UnsupportedFeature): void;
}

// A capability kept only so its channel keeps its DMX slot.
export function unsupported(feature: string): Capability {
  return { type: 'unsupported', feature };
}

// Collects unsupported features once each, in the order found.
export function createImportReport(): ImportReport {
  const features: UnsupportedFeature[] = [];
  const seen = new Set<string>();
  return {
    features,
    add(feature) {
      const key = JSON.stringify([feature.channel, feature.mode, feature.feature]);
      if (seen.has(key)) return;
      seen.add(key);
      features.push(feature);
    },
  };
}
