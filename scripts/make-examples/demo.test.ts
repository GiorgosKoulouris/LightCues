import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadShowFile } from '../../src/engine/show-file';
import { loadVenueFile } from '../../src/engine/venue-file';
import { ROLES } from '../../src/shared/fixture-profile';
import { ruleTargets, TRIGGER_MODES } from '../../src/shared/show';
import { approximatedAims } from '../../src/shared/venue-check';
import {
  fixtureMode,
  fixtureRole,
  fixtureZone,
  isMovingFixture,
  VIRTUAL_OUTPUT,
  zoneName,
} from '../../src/shared/venue-patch';
import { demoFiles } from './demo';

const read = (name: string) =>
  readFileSync(new URL(`../../examples/${name}`, import.meta.url), 'utf8');
const patch = loadVenueFile(read('demo.lcvenue'));
const show = loadShowFile(read('demo.lcshow'));

describe('the example Venue Patch and Show', () => {
  it('are what scripts/make-examples writes (run npm run examples)', () => {
    expect(demoFiles()).toEqual({ venue: read('demo.lcvenue'), show: read('demo.lcshow') });
  });

  it('cover every Role, several Zones, a moving and a multi-Cell Fixture', () => {
    const fixtures = patch.fixtures;
    expect(new Set(fixtures.map((f) => fixtureRole(patch, f)))).toEqual(new Set(ROLES));
    const zones = new Set(fixtures.map((f) => zoneName(fixtureZone(patch, f))));
    expect(zones.size).toBeGreaterThanOrEqual(3);
    expect(fixtures.some((f) => isMovingFixture(patch, f))).toBe(true);
    // A Cell per red emitter channel.
    const cells = (f: (typeof fixtures)[number]) =>
      fixtureMode(patch, f).channels.filter(
        (c) =>
          c.kind === 'control' &&
          c.ranges.some((r) => r.capability.type === 'emitter' && r.capability.emitter === 'red'),
      ).length;
    expect(Math.max(...fixtures.map(cells))).toBeGreaterThanOrEqual(8);
  });

  it('map every Universe to the Virtual Output', () => {
    expect(patch.universes.map((u) => u.output)).toEqual(patch.universes.map(() => VIRTUAL_OUTPUT));
  });

  it('fire existing Scenes from C3 upwards, with Go, Flash and Release', () => {
    const scenes = new Set(show.scenes.map((s) => s.id));
    for (const trigger of show.triggers) {
      expect(scenes).toContain(trigger.scene);
      expect(trigger.note).toBeGreaterThanOrEqual(48);
    }
    expect(new Set(show.triggers.map((t) => t.mode))).toEqual(new Set(TRIGGER_MODES));
    expect(show.scenes).toHaveLength(8);
    expect(show.baseLook).toBeDefined();
  });

  it('target a Fixture with every Rule and aim every Direction exactly', () => {
    for (const scene of show.scenes) {
      for (const rule of scene.rules) {
        expect(patch.fixtures.some((f) => ruleTargets(patch, f, rule))).toBe(true);
      }
    }
    expect(approximatedAims(show, patch)).toEqual([]);
  });
});
