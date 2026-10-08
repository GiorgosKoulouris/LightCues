import { beamLanding } from '../../../shared/aim';
import type { FixtureLight } from '../../../shared/protocol';
import { fixtureMounting, type VenuePatch } from '../../../shared/venue-patch';

// The width of a beam line, in metres.
const BEAM_LINE_WIDTH = 0.08;

// Top-down, a line from each lit moving Fixture to where its beam lands, in
// its colour, faded by its intensity. Nothing for a dark Fixture or one
// without an aim. `lights` is by Fixture id.
export function BeamLines({
  patch,
  lights,
}: {
  patch: VenuePatch;
  lights: Record<string, FixtureLight>;
}) {
  return patch.fixtures.map((fixture) => {
    const light = lights[fixture.id];
    if (!light?.aim || light.intensity <= 0) return null;
    const landing = beamLanding({
      position: fixture,
      mounting: fixtureMounting(fixture),
      stage: patch.stage,
      angles: light.aim,
    });
    return (
      <line
        key={fixture.id}
        data-testid={`beam-${fixture.id}`}
        x1={fixture.x}
        y1={-fixture.y}
        x2={landing.x}
        y2={-landing.y}
        stroke={lightColour(light)}
        strokeOpacity={light.intensity}
        strokeWidth={BEAM_LINE_WIDTH}
        strokeLinecap="round"
      />
    );
  });
}

export function lightColour({ red, green, blue }: FixtureLight): string {
  const byte = (level: number) => Math.round(level * 255);
  return `rgb(${byte(red)} ${byte(green)} ${byte(blue)})`;
}
