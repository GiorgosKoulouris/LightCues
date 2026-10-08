import { BEAM_UP_LENGTH } from '../../../shared/aim';
import type { FixtureLight } from '../../../shared/protocol';
import { fixtureZone, type PatchedFixture, type VenuePatch } from '../../../shared/venue-patch';
import { StageGrid, stageViewBox } from '../venue/StagePlan';
import { BeamLines, lightColour } from './BeamLines';
import styles from './Preview.module.css';
import { usePreview } from './usePreview';

const FIXTURE_RADIUS = 0.25;
const MARGIN = 1;
// Half the angle of a drawn beam.
const BEAM_HALF_ANGLE = (12 * Math.PI) / 180;
// The front elevation shows at least this height, in metres.
const MIN_VIEW_HEIGHT = 4;

const DARK: FixtureLight = { intensity: 0, red: 0, green: 0, blue: 0 };

// The engine's resolved look, top-down and from the audience. In Monitor it is
// what the rig shows; in Blind, what it would show.
export function Preview({ patch }: { patch: VenuePatch }) {
  const lights = usePreview();
  const light = (fixture: PatchedFixture) => lights[fixture.id] ?? DARK;

  return (
    <div className={styles.views}>
      <TopDown patch={patch} lights={lights} light={light} />
      <FrontElevation patch={patch} light={light} />
    </div>
  );
}

interface ViewProps {
  patch: VenuePatch;
  light(fixture: PatchedFixture): FixtureLight;
}

// The stage plan out to the audience plane, each Fixture filled with its
// light, and each lit moving Fixture's beam drawn to where it lands.
function TopDown({ patch, lights, light }: ViewProps & { lights: Record<string, FixtureLight> }) {
  return (
    <svg
      viewBox={stageViewBox(patch.stage, { audience: true })}
      className={styles.view}
      role="img"
      aria-label="Top-down preview"
    >
      <StageGrid stage={patch.stage} audience />
      <BeamLines patch={patch} lights={lights} />
      {patch.fixtures.map((fixture) => (
        <g key={fixture.id} transform={`translate(${fixture.x} ${-fixture.y})`}>
          <title>{fixture.name}</title>
          <FixtureMarker light={light(fixture)} />
        </g>
      ))}
    </svg>
  );
}

// The stage seen from the audience, Stage Left on the right, each Fixture at
// its height. Overhead Fixtures beam down to the floor, Floor Fixtures up.
// Upstage Fixtures are drawn first, so downstage ones are in front.
function FrontElevation({ patch, light }: ViewProps) {
  const { width } = patch.stage;
  const top = Math.max(MIN_VIEW_HEIGHT, ...patch.fixtures.map((f) => f.height + MARGIN));
  const upstageFirst = [...patch.fixtures].sort((a, b) => b.y - a.y);
  // SVG coordinates are metres with y flipped: height = -svg y.
  const viewBox = `${-width / 2 - MARGIN} ${-top} ${width + 2 * MARGIN} ${top + MARGIN}`;

  return (
    <svg viewBox={viewBox} className={styles.view} role="img" aria-label="Front elevation preview">
      <rect
        x={-width / 2}
        y={0}
        width={width}
        height={0.15}
        className={styles.floor}
        strokeWidth={0.03}
      />
      <g className={styles.label} fontSize={0.3} textAnchor="middle">
        <text x={-width / 3} y={0.6}>
          Stage Right
        </text>
        <text x={0} y={0.6}>
          Centre
        </text>
        <text x={width / 3} y={0.6}>
          Stage Left
        </text>
      </g>
      {upstageFirst.map((fixture) => {
        const shown = light(fixture);
        return (
          <g key={fixture.id}>
            <title>{fixture.name}</title>
            {shown.intensity > 0 && (
              <polygon
                points={beam(patch, fixture)}
                fill={lightColour(shown)}
                fillOpacity={0.55 * shown.intensity}
              />
            )}
            <g transform={`translate(${fixture.x} ${-fixture.height})`}>
              <FixtureMarker light={shown} />
            </g>
          </g>
        );
      })}
    </svg>
  );
}

// A Fixture's body: dark, lit in its colour by its intensity.
function FixtureMarker({ light }: { light: FixtureLight }) {
  return (
    <>
      <circle r={FIXTURE_RADIUS} className={styles.body} strokeWidth={0.04} />
      <circle r={FIXTURE_RADIUS} fill={lightColour(light)} fillOpacity={light.intensity} />
    </>
  );
}

// The beam cone's corners in SVG coordinates: down to the floor from an
// Overhead Fixture, up from a Floor one.
function beam(patch: VenuePatch, fixture: PatchedFixture): string {
  const { x, height } = fixture;
  const overhead = fixtureZone(patch, fixture).level === 'Overhead';
  const end = overhead ? 0 : height + BEAM_UP_LENGTH;
  const spread = Math.abs(end - height) * Math.tan(BEAM_HALF_ANGLE);
  return `${x},${-height} ${x - spread},${-end} ${x + spread},${-end}`;
}
