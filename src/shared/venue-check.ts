// What a Show needs from a Venue Patch that the rig only gives in part: the
// makings of the Venue Check. Pure, and shared so the editors can show it
// where the operator fixes it.
import { aimAt, type Approximation } from './aim';
import { DEFAULT_DIRECTION, DIRECTIONS, ruleTargets, type Direction, type Show } from './show';
import {
  fixtureMode,
  fixtureMounting,
  isMovingFixture,
  type PatchedFixture,
  type VenuePatch,
} from './venue-patch';

// A Direction a moving Fixture cannot be aimed at exactly, and why.
export interface ApproximatedAim {
  fixtureId: string;
  direction: Direction;
  approximations: Approximation[];
}

// Every moving Fixture × Direction the Show uses whose aim is approximated,
// in patch order, then Direction order.
export function approximatedAims(show: Show, patch: VenuePatch): ApproximatedAim[] {
  return patch.fixtures.flatMap((fixture) => fixtureApproximatedAims(show, patch, fixture));
}

// The Directions the Show uses that one Fixture only approximates, in
// Direction order; none unless it moves. A moving Fixture uses the Default
// Direction and the Directions of the Rules that target it.
export function fixtureApproximatedAims(
  show: Show,
  patch: VenuePatch,
  fixture: PatchedFixture,
): ApproximatedAim[] {
  if (!isMovingFixture(patch, fixture)) return [];
  const used = new Set<Direction>([show.defaultDirection ?? DEFAULT_DIRECTION]);
  for (const rule of show.scenes.flatMap((scene) => scene.rules)) {
    if (rule.direction && ruleTargets(patch, fixture, rule)) used.add(rule.direction);
  }
  return DIRECTIONS.flatMap((direction) => {
    if (!used.has(direction)) return [];
    const aim = aimAt({
      position: fixture,
      mounting: fixtureMounting(fixture),
      channels: fixtureMode(patch, fixture).channels,
      stage: patch.stage,
      direction,
    });
    const approximations = aim?.approximations ?? [];
    return approximations.length > 0 ? [{ fixtureId: fixture.id, direction, approximations }] : [];
  });
}
