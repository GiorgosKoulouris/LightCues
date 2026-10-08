import { Clapperboard, LayoutGrid, Library, MonitorPlay, type LucideIcon } from 'lucide-react';
import { cx } from '../ui/cx';
import { Tooltip } from '../ui/Tooltip';
import { viewShortcut } from './shortcuts';
import styles from './Sidebar.module.css';
import { VIEWS, type View } from './views';

const ICONS: Record<View, LucideIcon> = {
  show: Clapperboard,
  venue: LayoutGrid,
  profiles: Library,
  perform: MonitorPlay,
};

// Switches between the views. Each shows its Ctrl shortcut as a tooltip.
export function Sidebar({ view, onView }: { view: View; onView: (view: View) => void }) {
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
    </nav>
  );
}
