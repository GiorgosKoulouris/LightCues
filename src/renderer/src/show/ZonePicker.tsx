import {
  fixtureZone,
  sameZone,
  ZONE_COLUMNS,
  ZONE_LEVELS,
  ZONE_ROWS,
  type VenuePatch,
  type Zone,
  type ZoneLevel,
  zoneName,
} from '../../../shared/venue-patch';
import { Button } from '../ui/Button';
import { cx } from '../ui/cx';
import { FRONT_DEPTH, stageViewBox, zoneRowBounds } from '../venue/StagePlan';
import styles from './ZonePicker.module.css';

interface ZonePickerProps {
  // Draws the current Venue Patch's stage and Fixtures, for reference.
  patch: VenuePatch;
  // Undefined means every Zone.
  zones?: Zone[];
  onChange(zones: Zone[] | undefined): void;
}

// Picks a Rule's Zones on two top-down stage plans, Floor and Overhead.
// Clicking a cell toggles its Zone. While every Zone is targeted, a click
// targets that Zone alone. The last Zone cannot be untoggled; choose Every
// Zone instead.
export function ZonePicker({ patch, zones, onChange }: ZonePickerProps) {
  function toggle(zone: Zone) {
    if (!zones) return onChange([zone]);
    const picked = zones.some((z) => sameZone(z, zone));
    if (!picked) return onChange([...zones, zone]);
    const rest = zones.filter((z) => !sameZone(z, zone));
    if (rest.length > 0) onChange(rest);
  }

  return (
    <fieldset className={styles.picker}>
      <legend className={styles.legend}>
        Zones{' '}
        <span className={styles.summary}>
          {zones === undefined
            ? 'every Zone; click one to target it alone'
            : zones.map(zoneName).join(', ')}
        </span>
      </legend>
      <div className={styles.plans}>
        {ZONE_LEVELS.map((level) => (
          <LevelPlan
            key={level}
            patch={patch}
            level={level}
            isPicked={(zone) => !zones || zones.some((z) => sameZone(z, zone))}
            onToggle={toggle}
          />
        ))}
      </div>
      {zones !== undefined && (
        <Button variant="ghost" onClick={() => onChange(undefined)}>
          Every Zone
        </Button>
      )}
    </fieldset>
  );
}

function LevelPlan({
  patch,
  level,
  isPicked,
  onToggle,
}: {
  patch: VenuePatch;
  level: ZoneLevel;
  isPicked(zone: Zone): boolean;
  onToggle(zone: Zone): void;
}) {
  const { width } = patch.stage;
  const rows = zoneRowBounds(patch.stage);
  const fixtures = patch.fixtures.filter((f) => fixtureZone(patch, f).level === level);

  return (
    <figure className={styles.plan}>
      <svg
        viewBox={stageViewBox(patch.stage)}
        className={styles.svg}
        role="group"
        aria-label={`${level} Zones`}
      >
        {ZONE_ROWS.map((row) =>
          ZONE_COLUMNS.map((column, i) => {
            const zone: Zone = { row, column, level };
            const [top, bottom] = rows[row];
            const picked = isPicked(zone);
            return (
              <rect
                key={`${row}/${column}`}
                x={-width / 2 + (width * i) / 3}
                y={top}
                width={width / 3}
                height={bottom - top}
                className={cx(styles.zone, picked && styles.picked)}
                strokeWidth={0.03}
                role="checkbox"
                aria-checked={picked}
                aria-label={zoneName(zone)}
                onClick={() => onToggle(zone)}
              >
                <title>{zoneName(zone)}</title>
              </rect>
            );
          }),
        )}
        {fixtures.map((fixture) => (
          <circle
            key={fixture.id}
            cx={fixture.x}
            cy={-fixture.y}
            r={0.15}
            className={styles.fixture}
          />
        ))}
        <text
          x={0}
          y={FRONT_DEPTH + 0.6}
          className={styles.label}
          fontSize={0.3}
          textAnchor="middle"
        >
          Audience
        </text>
      </svg>
      <figcaption className={styles.caption}>{level}</figcaption>
    </figure>
  );
}
