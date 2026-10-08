import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { audienceY } from '../../../shared/aim';
import {
  fixtureRole,
  fixtureZone,
  type PatchedFixture,
  type StageBounds,
  type StagePosition,
  type VenuePatch,
  type ZoneRow,
  zoneName,
} from '../../../shared/venue-patch';
import { cx } from '../ui/cx';
import { selectModifiers, type SelectModifiers } from '../ui/List';
import styles from './StagePlan.module.css';

// Depth of the Front row drawn in front of the stage, in metres.
export const FRONT_DEPTH = 2;
const MARGIN = 1;
const FIXTURE_RADIUS = 0.25;
// Dragged positions snap to this, in metres.
const SNAP = 0.05;

interface StagePlanProps {
  patch: VenuePatch;
  selectedIds: readonly string[];
  // Shift and Ctrl clicks select without dragging.
  onSelect(id: string, modifiers: SelectModifiers): void;
  // Keys the plan does not handle itself, such as Delete.
  onKeyDown?(event: KeyboardEvent<SVGSVGElement>): void;
  // Resolves once the engine has answered, so the plan can stop showing the
  // dragged position.
  onMove(id: string, position: StagePosition): Promise<unknown>;
  // Shows the plan out to the audience plane.
  audience?: boolean;
  // Drawn over the stage, under the Fixtures.
  children?: ReactNode;
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
// would be in shows while dragging. Shift and Ctrl click select several.
export function StagePlan({
  patch,
  selectedIds,
  onSelect,
  onKeyDown,
  onMove,
  audience = false,
  children,
}: StagePlanProps) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag>();

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
    svg.current?.focus();
    const modifiers = selectModifiers(event);
    if (modifiers.range || modifiers.toggle) {
      onSelect(fixture.id, modifiers);
      return;
    }
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
    onSelect(fixture.id, modifiers);
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
    <figure className={styles.figure}>
      <svg
        ref={svg}
        viewBox={stageViewBox(patch.stage, { audience })}
        className={styles.plan}
        role="img"
        aria-label="Top-down stage plan"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <StageGrid stage={patch.stage} audience={audience} />
        {children}
        {patch.fixtures.map((fixture) => {
          const shown = position(fixture);
          const overhead = fixtureZone(patch, shown).level === 'Overhead';
          return (
            <g
              key={fixture.id}
              transform={`translate(${shown.x} ${-shown.y})`}
              className={cx(
                styles.fixture,
                overhead && styles.overhead,
                selectedIds.includes(fixture.id) && styles.selected,
              )}
              data-testid={`plan-${fixture.id}`}
              onPointerDown={(e) => startDrag(e, fixture)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={() => setDrag(undefined)}
            >
              <title>
                {`${fixture.name} (${fixtureRole(patch, fixture)}), ${fixture.universe}.${fixture.address}`}
              </title>
              <circle r={FIXTURE_RADIUS} className={styles.marker} />
              <text y={FIXTURE_RADIUS + 0.35} fontSize={0.28} className={styles.name}>
                {fixture.name}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className={styles.caption}>
        {dragged && drag.moved
          ? `${dragged.name}: x ${drag.x.toFixed(2)} m, y ${drag.y.toFixed(2)} m → ` +
            zoneName(fixtureZone(patch, position(dragged))) +
            (dragged.zone ? ' (Zone override)' : '')
          : 'Drag a Fixture to move it. Shift or Ctrl click to select several. Dashed: Overhead.'}
      </figcaption>
    </figure>
  );
}

// The stage, the Front row in front of it, the Zone grid and its labels,
// top-down in SVG coordinates (see `stageViewBox`). With `audience`, the
// audience plane too.
export function StageGrid({ stage, audience = false }: { stage: StageBounds; audience?: boolean }) {
  const { width, depth } = stage;
  return (
    <>
      {audience && (
        <line
          data-testid="audience-plane"
          x1={-width / 2 - MARGIN}
          x2={width / 2 + MARGIN}
          y1={-audienceY(stage)}
          y2={-audienceY(stage)}
          className={styles.audiencePlane}
          strokeWidth={0.03}
          strokeDasharray="0.15 0.1"
        />
      )}
      <rect
        x={-width / 2}
        y={-depth}
        width={width}
        height={depth}
        className={styles.stage}
        strokeWidth={0.04}
      />
      <rect
        x={-width / 2}
        y={0}
        width={width}
        height={FRONT_DEPTH}
        className={styles.front}
        strokeWidth={0.03}
        strokeDasharray="0.15 0.1"
      />
      {[1, 2].map((i) => (
        <g key={i} className={styles.gridLine} strokeWidth={0.02}>
          <line
            x1={-width / 2 + (width * i) / 3}
            x2={-width / 2 + (width * i) / 3}
            y1={-depth}
            y2={FRONT_DEPTH}
          />
          <line x1={-width / 2} x2={width / 2} y1={(-depth * i) / 3} y2={(-depth * i) / 3} />
        </g>
      ))}
      <g className={styles.label} fontSize={0.3} textAnchor="middle">
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
      <g className={styles.label} fontSize={0.3} textAnchor="end">
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
    </>
  );
}

// SVG coordinates are metres with y flipped: stage y = -svg y. The view
// shows the stage, the Front row, or with `audience` out to the audience
// plane, and a margin.
export function stageViewBox(stage: StageBounds, { audience = false } = {}): string {
  const { width, depth } = stage;
  const front = audience ? -audienceY(stage) : FRONT_DEPTH;
  return `${-width / 2 - MARGIN} ${-depth - MARGIN} ${width + 2 * MARGIN} ${depth + front + 2 * MARGIN}`;
}

// Each Zone row's top and bottom in SVG y, Front first.
export function zoneRowBounds({ depth }: StageBounds): Record<ZoneRow, [number, number]> {
  return {
    Front: [0, FRONT_DEPTH],
    Downstage: [-depth / 3, 0],
    Midstage: [(-depth * 2) / 3, -depth / 3],
    Upstage: [-depth, (-depth * 2) / 3],
  };
}

function snap(metres: number): number {
  // toFixed drops float noise such as 0.15000000000000002.
  return Number((Math.round(metres / SNAP) * SNAP).toFixed(2));
}
