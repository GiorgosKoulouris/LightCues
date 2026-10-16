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

// Collects unsupported features once each, in the order found. A channel line
// given with its mode and held value drops the mode when the channel is held
// at the same value in every mode that reports it.
export function createImportReport(): ImportReport {
  const lines: UnsupportedFeature[] = [];
  const seen = new Set<string>();
  const heldPerMode = (line: UnsupportedFeature) =>
    line.mode !== undefined && line.held !== undefined;
  const channelFeatureKey = (line: UnsupportedFeature) =>
    JSON.stringify([line.channel, line.feature]);
  return {
    get features() {
      const heldValues = new Map<string, Set<number>>();
      for (const line of lines.filter(heldPerMode)) {
        const key = channelFeatureKey(line);
        heldValues.set(key, (heldValues.get(key) ?? new Set()).add(line.held!));
      }
      const merged = new Set<string>();
      return lines.flatMap((line) => {
        const key = channelFeatureKey(line);
        if (!heldPerMode(line) || heldValues.get(key)!.size > 1) return [line];
        if (merged.has(key)) return [];
        merged.add(key);
        return [{ channel: line.channel, feature: line.feature, held: line.held }];
      });
    },
    add(feature) {
      const key = JSON.stringify([feature.channel, feature.mode, feature.feature]);
      if (seen.has(key)) return;
      seen.add(key);
      lines.push(feature);
    },
  };
}
