import { useRef, useState, type PointerEvent } from 'react';
import {
  fixtureRole,
  fixtureZone,
  type PatchedFixture,
  type StagePosition,
  type VenuePatch,
  type Zone,
} from '../../../shared/venue-patch';

// Depth of the Front row drawn in front of the stage, in metres.
const FRONT_DEPTH = 2;
const MARGIN = 1;
const FIXTURE_RADIUS = 0.25;
// Dragged positions snap to this, in metres.
const SNAP = 0.05;

interface StagePlanProps {
  patch: VenuePatch;
  selectedId?: string;
  onSelect(id: string): void;
  // Resolves once the engine has answered, so the plan can stop showing the
  // dragged position.
  onMove(id: string, position: StagePosition): Promise<unknown>;
}

interface Drag {
  id: string;
  // Pointer offset from the Fixture centre, in metres, so it does not jump.
  dx: number;
  dy: number;
  x: number;
  y: number;
  moved: boolean;
  // Dropped and waiting for the engine.
  released: boolean;
}

// Top-down view of the stage and its Zone grid, seen with the audience at the
// bottom: Stage Left is on the right. Fixtures can be dragged; the Zone they
// would be in shows while dragging.
export function StagePlan({ patch, selectedId, onSelect, onMove }: StagePlanProps) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag>();
  const { width, depth } = patch.stage;

  // SVG coordinates are metres with y flipped: stage y = -svg y.
  function stagePoint(event: PointerEvent): { x: number; y: number } {
    const matrix = svg.current?.getScreenCTM()?.inverse();
    if (!matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
    return { x: point.x, y: -point.y };
  }

  function position(fixture: PatchedFixture): PatchedFixture {
    return drag?.id === fixture.id ? { ...fixture, x: drag.x, y: drag.y } : fixture;
  }

  function startDrag(event: PointerEvent, fixture: PatchedFixture) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = stagePoint(event);
    setDrag({
      id: fixture.id,
      dx: x - fixture.x,
      dy: y - fixture.y,
      x: fixture.x,
      y: fixture.y,
      moved: false,
      released: false,
    });
    onSelect(fixture.id);
  }

  function moveDrag(event: PointerEvent) {
    if (!drag || drag.released) return;
    const { x, y } = stagePoint(event);
    setDrag({ ...drag, x: snap(x - drag.dx), y: snap(y - drag.dy), moved: true });
  }

  function endDrag() {
    if (!drag || drag.released) return;
    const fixture = patch.fixtures.find((f) => f.id === drag.id);
    if (!drag.moved || !fixture) {
      setDrag(undefined);
      return;
    }
    // Keep showing the dropped position until the engine's patch replaces it.
    setDrag({ ...drag, released: true });
    void onMove(drag.id, { x: drag.x, y: drag.y, height: fixture.height }).finally(() =>
      setDrag(undefined),
    );
  }

  const dragged = drag && patch.fixtures.find((f) => f.id === drag.id);

  return (
    <figure style={{ margin: 0 }}>
      <svg
        ref={svg}
        viewBox={`${-width / 2 - MARGIN} ${-depth - MARGIN} ${width + 2 * MARGIN} ${depth + FRONT_DEPTH + 2 * MARGIN}`}
        style={{ width: '100%', maxWidth: 800, background: '#1b1d22', touchAction: 'none' }}
        role="img"
        aria-label="Top-down stage plan"
      >
        <rect
          x={-width / 2}
          y={-depth}
          width={width}
          height={depth}
          fill="#2a2d35"
          stroke="#aab"
          strokeWidth={0.04}
        />
        <rect
          x={-width / 2}
          y={0}
          width={width}
          height={FRONT_DEPTH}
          fill="none"
          stroke="#667"
          strokeWidth={0.03}
          strokeDasharray="0.15 0.1"
        />
        {[1, 2].map((i) => (
          <g key={i} stroke="#556" strokeWidth={0.02}>
            <line
              x1={-width / 2 + (width * i) / 3}
              x2={-width / 2 + (width * i) / 3}
              y1={-depth}
              y2={FRONT_DEPTH}
            />
            <line x1={-width / 2} x2={width / 2} y1={(-depth * i) / 3} y2={(-depth * i) / 3} />
          </g>
        ))}
        <g fill="#889" fontSize={0.3} textAnchor="middle">
          <text x={-width / 3} y={-depth - 0.3}>
            Stage Right
          </text>
          <text x={0} y={-depth - 0.3}>
            Centre
          </text>
          <text x={width / 3} y={-depth - 0.3}>
            Stage Left
          </text>
          <text x={0} y={FRONT_DEPTH + 0.6}>
            Audience
          </text>
        </g>
        <g fill="#889" fontSize={0.3} textAnchor="end">
          <text x={-width / 2 - 0.1} y={(-depth * 5) / 6}>
            Up
          </text>
          <text x={-width / 2 - 0.1} y={-depth / 2}>
            Mid
          </text>
          <text x={-width / 2 - 0.1} y={-depth / 6}>
            Down
          </text>
          <text x={-width / 2 - 0.1} y={FRONT_DEPTH / 2}>
            Front
          </text>
        </g>
        {patch.fixtures.map((fixture) => {
          const shown = position(fixture);
          const selected = fixture.id === selectedId;
          const overhead = fixtureZone(patch, shown).level === 'Overhead';
          return (
            <g
              key={fixture.id}
              transform={`translate(${shown.x} ${-shown.y})`}
              style={{ cursor: 'grab' }}
              onPointerDown={(e) => startDrag(e, fixture)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={() => setDrag(undefined)}
            >
              <title>
                {`${fixture.name} (${fixtureRole(patch, fixture)}), ${fixture.universe}.${fixture.address}`}
              </title>
              <circle
                r={FIXTURE_RADIUS}
                fill={overhead ? 'none' : '#e8b44c'}
                stroke={selected ? '#fff' : '#e8b44c'}
                strokeWidth={selected ? 0.08 : 0.05}
                strokeDasharray={overhead ? '0.1 0.06' : undefined}
              />
              <text y={FIXTURE_RADIUS + 0.35} fill="#dde" fontSize={0.28} textAnchor="middle">
                {fixture.name}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption>
        {dragged && drag.moved
          ? `${dragged.name}: x ${drag.x.toFixed(2)} m, y ${drag.y.toFixed(2)} m → ` +
            zoneName(fixtureZone(patch, position(dragged))) +
            (dragged.zone ? ' (Zone override)' : '')
          : 'Drag a Fixture to move it. Dashed: Overhead.'}
      </figcaption>
    </figure>
  );
}

export function zoneName({ row, column, level }: Zone): string {
  return `${row} ${column} ${level}`;
}

function snap(metres: number): number {
  // toFixed drops float noise such as 0.15000000000000002.
  return Number((Math.round(metres / SNAP) * SNAP).toFixed(2));
}
