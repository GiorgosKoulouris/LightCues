import { beamLanding } from '../../../shared/aim';
import type { FixtureLight } from '../../../shared/protocol';
import { fixtureMounting, type VenuePatch } from '../../../shared/venue-patch';
import type { View } from '../venue/pixelScale';

// The width of a beam line, in metres.
const BEAM_LINE_WIDTH = 0.08;
// The arrow at the end of a beam cut at the view's edge, in metres.
const ARROW_LENGTH = 0.4;
const ARROW_WIDTH = 0.3;

interface Point {
  x: number;
  y: number;
}

// Top-down, a line from each lit moving Fixture to where its beam lands, in
// its colour, faded by its intensity. A beam that leaves `view` is cut at its
// edge and ends in an arrow. Nothing for a dark Fixture or one without an
// aim. `lights` is by Fixture id.
export function BeamLines({
  patch,
  lights,
  view,
}: {
  patch: VenuePatch;
  lights: Record<string, FixtureLight>;
  view: View;
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
    // SVG coordinates are metres with y flipped: stage y = -svg y.
    const from = { x: fixture.x, y: -fixture.y };
    const { end, cut } = clipToView(from, { x: landing.x, y: -landing.y }, view);
    const colour = lightColour(light);
    const arrow = cut ? arrowHead(from, end) : undefined;
    const lineEnd = arrow?.base ?? end;
    return (
      <g key={fixture.id}>
        <line
          data-testid={`beam-${fixture.id}`}
          x1={from.x}
          y1={from.y}
          x2={lineEnd.x}
          y2={lineEnd.y}
          stroke={colour}
          strokeOpacity={light.intensity}
          strokeWidth={BEAM_LINE_WIDTH}
          strokeLinecap="round"
        />
        {arrow && (
          <polygon
            data-testid={`beam-arrow-${fixture.id}`}
            points={arrow.points}
            fill={colour}
            fillOpacity={light.intensity}
          />
        )}
      </g>
    );
  });
}

export function lightColour({ red, green, blue }: FixtureLight): string {
  const byte = (level: number) => Math.round(level * 255);
  return `rgb(${byte(red)} ${byte(green)} ${byte(blue)})`;
}

// The line from `from`, inside `view`, to `to`, cut where it leaves `view`.
function clipToView(from: Point, to: Point, view: View): { end: Point; cut: boolean } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // How far along the line each edge it heads for is, from 0 to 1.
  const along = (start: number, delta: number, low: number, high: number) =>
    delta > 0 ? (high - start) / delta : delta < 0 ? (low - start) / delta : Infinity;
  const t = Math.min(
    along(from.x, dx, view.x, view.x + view.width),
    along(from.y, dy, view.y, view.y + view.height),
  );
  if (t >= 1) return { end: to, cut: false };
  const s = Math.max(t, 0);
  return { end: { x: from.x + dx * s, y: from.y + dy * s }, cut: true };
}

// An arrow pointing from `from` with its tip at `tip`, no longer than the
// line, and where the line should stop under it.
function arrowHead(from: Point, tip: Point): { points: string; base: Point } {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { points: '', base: tip };
  const ux = dx / length;
  const uy = dy / length;
  const arrowLength = Math.min(ARROW_LENGTH, length);
  const base = { x: tip.x - ux * arrowLength, y: tip.y - uy * arrowLength };
  // Half the width, square to the line.
  const nx = (-uy * ARROW_WIDTH) / 2;
  const ny = (ux * ARROW_WIDTH) / 2;
  const points = [
    [tip.x, tip.y],
    [base.x + nx, base.y + ny],
    [base.x - nx, base.y - ny],
  ]
    .map((p) => p.join(','))
    .join(' ');
  return { points, base };
}
