import {
  CircleArrowUp,
  Clapperboard,
  LayoutGrid,
  Library,
  MonitorPlay,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { cx } from '../ui/cx';
import { Tooltip } from '../ui/Tooltip';
import { viewShortcut } from './shortcuts';
import styles from './Sidebar.module.css';
import { useUpdates } from './useUpdates';
import { VIEWS, type View } from './views';

const ICONS: Record<View, LucideIcon> = {
  show: Clapperboard,
  venue: LayoutGrid,
  profiles: Library,
  perform: MonitorPlay,
};

// Switches between the views. Each shows its Ctrl shortcut as a tooltip.
// Below them, a newer release, never in Perform, and the update setting.
export function Sidebar({ view, onView }: { view: View; onView: (view: View) => void }) {
  const updates = useUpdates();
  return (
    <nav aria-label="Views" className={styles.sidebar}>
      <p className={styles.app}>LightCues</p>
      {VIEWS.map(({ id, label }) => {
        const Icon = ICONS[id];
        return (
          <Tooltip key={id} content={viewShortcut(id)} side="right">
            <button
              type="button"
              aria-current={view === id ? 'page' : undefined}
              className={cx(styles.item, view === id && styles.current)}
              onClick={() => onView(id)}
            >
              <Icon aria-hidden />
              {label}
            </button>
          </Tooltip>
        );
      })}
      <div className={styles.footer}>
        {updates.available && view !== 'perform' && (
          <div role="status" aria-label="Update available" className={styles.update}>
            <p>LightCues {updates.available.version} is available</p>
            <Button icon={<CircleArrowUp aria-hidden />} onClick={updates.openReleasePage}>
              Open release page
            </Button>
          </div>
        )}
        {updates.enabled !== undefined && (
          <Checkbox
            label="Check for updates"
            className={styles.setting}
            checked={updates.enabled}
            onChange={updates.setEnabled}
          />
        )}
      </div>
    </nav>
  );
}
