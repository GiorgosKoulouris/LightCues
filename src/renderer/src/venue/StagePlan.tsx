import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
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
import {
  atPixels,
  FIXTURE_MARKER_RADIUS,
  LABEL_GAP,
  LABEL_ROOM,
  usePixelView,
  type View,
} from './pixelScale';
import styles from './StagePlan.module.css';

// Depth of the Front row drawn in front of the stage, in metres. Only drawn:
// anything in front of the stage is in the Front row.
export const FRONT_DEPTH = 1;
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
  // False hides the Fixture labels, except on the selected and dragged Fixtures.
  showLabels?: boolean;
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
// Every Fixture has a hover tooltip, labelled or not.
export function StagePlan({
  patch,
  selectedIds,
  onSelect,
  onKeyDown,
  onMove,
  showLabels = true,
  children,
}: StagePlanProps) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag>();
  // From the patch, not the dragged position, so the view holds still while
  // dragging.
  const { scale, viewBox } = usePixelView(svg, stageView(patch.stage, patch.fixtures), LABEL_ROOM);

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
        viewBox={viewBox}
        className={styles.plan}
        role="img"
        aria-label="Top-down stage plan"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <StageGrid stage={patch.stage} scale={scale} />
        {children}
        {patch.fixtures.map((fixture) => {
          const shown = position(fixture);
          const overhead = fixtureZone(patch, shown).level === 'Overhead';
          const selected = selectedIds.includes(fixture.id);
          return (
            <g
              key={fixture.id}
              transform={atPixels(shown.x, -shown.y, scale)}
              className={cx(
                styles.fixture,
                overhead && styles.overhead,
                selected && styles.selected,
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
              <circle r={FIXTURE_MARKER_RADIUS} className={styles.marker} />
              {(showLabels || selected || drag?.id === fixture.id) && (
                <text y={FIXTURE_MARKER_RADIUS} dy="1.1em" className={styles.name}>
                  {fixture.name}
                </text>
              )}
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
// top-down in SVG coordinates (see `stageView`). The labels are a fixed screen size: `scale` is the
// SVG's pixels per metre (see `usePixelView`). They need `LABEL_ROOM` around
// the view.
export function StageGrid({ stage, scale }: { stage: StageBounds; scale: number }) {
  const { width, depth } = stage;
  const label = (x: number, y: number, text: string, place: 'above' | 'below' | 'left') => (
    <text
      key={text}
      transform={atPixels(x, y, scale)}
      x={place === 'left' ? -LABEL_GAP : 0}
      y={place === 'above' ? -LABEL_GAP : place === 'below' ? LABEL_GAP : 0}
      dy={place === 'above' ? 0 : place === 'below' ? '1em' : '0.35em'}
    >
      {text}
    </text>
  );
  return (
    <>
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
      <g className={styles.label} textAnchor="middle">
        {label(-width / 3, -depth, 'Stage Right', 'above')}
        {label(0, -depth, 'Centre', 'above')}
        {label(width / 3, -depth, 'Stage Left', 'above')}
        {label(0, FRONT_DEPTH, 'Audience', 'below')}
      </g>
      <g className={styles.label} textAnchor="end">
        {label(-width / 2, (-depth * 5) / 6, 'Up', 'left')}
        {label(-width / 2, -depth / 2, 'Mid', 'left')}
        {label(-width / 2, -depth / 6, 'Down', 'left')}
        {label(-width / 2, FRONT_DEPTH / 2, 'Front', 'left')}
      </g>
    </>
  );
}

// SVG coordinates are metres with y flipped: stage y = -svg y. The view
// shows the stage and the Front row, grown to take in any of `fixtures`
// outside them. No margin: labels and markers have their room in pixels.
export function stageView(
  { width, depth }: StageBounds,
  fixtures: readonly { x: number; y: number }[] = [],
): View {
  const left = Math.min(-width / 2, ...fixtures.map((f) => f.x));
  const right = Math.max(width / 2, ...fixtures.map((f) => f.x));
  const top = Math.min(-depth, ...fixtures.map((f) => -f.y));
  const bottom = Math.max(FRONT_DEPTH, ...fixtures.map((f) => -f.y));
  return { x: left, y: top, width: right - left, height: bottom - top };
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
