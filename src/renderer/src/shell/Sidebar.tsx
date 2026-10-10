import {
  BookOpen,
  CircleArrowUp,
  Clapperboard,
  ClipboardCopy,
  LayoutGrid,
  Library,
  MonitorPlay,
  RefreshCw,
  Scale,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { cx } from '../ui/cx';
import { Menu } from '../ui/Menu';
import { Tooltip } from '../ui/Tooltip';
import { viewShortcut } from './shortcuts';
import styles from './Sidebar.module.css';
import { useOpenLicense } from './useOpenLicense';
import { useUpdates, type CheckNowState } from './useUpdates';
import { VIEWS, type View } from './views';

const ICONS: Record<View, LucideIcon> = {
  show: Clapperboard,
  venue: LayoutGrid,
  profiles: Library,
  perform: MonitorPlay,
};

const CHECK_NOW_MESSAGES: Record<CheckNowState, string> = {
  checking: 'Checking for updates…',
  upToDate: 'LightCues is up to date',
  failed: 'Could not check for updates',
};

// Switches between the views. Each shows its Ctrl shortcut as a tooltip.
// Below them, outside Perform: Open example, Copy diagnostics, Licenses, a
// newer release and how a check asked for ended. Then a button to check now
// and the startup setting.
export function Sidebar({
  view,
  onView,
  onOpenExample,
  onCopyDiagnostics,
}: {
  view: View;
  onView: (view: View) => void;
  onOpenExample: () => void;
  onCopyDiagnostics: () => void;
}) {
  const updates = useUpdates();
  const openLicense = useOpenLicense();
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
        {view !== 'perform' && (
          <>
            <Button
              variant="ghost"
              icon={<BookOpen aria-hidden />}
              className={styles.action}
              onClick={onOpenExample}
            >
              Open example
            </Button>
            <Button
              variant="ghost"
              icon={<ClipboardCopy aria-hidden />}
              className={styles.action}
              onClick={onCopyDiagnostics}
            >
              Copy diagnostics
            </Button>
            <Menu
              align="start"
              trigger={
                <Button variant="ghost" icon={<Scale aria-hidden />} className={styles.action}>
                  Licenses
                </Button>
              }
              items={[
                { label: 'LightCues license', onSelect: () => void openLicense('license') },
                {
                  label: 'Third-party notices',
                  onSelect: () => void openLicense('thirdPartyNotices'),
                },
              ]}
            />
          </>
        )}
        {updates.available && view !== 'perform' && (
          <div role="status" aria-label="Update available" className={styles.update}>
            <p>LightCues {updates.available.version} is available</p>
            <Button icon={<CircleArrowUp aria-hidden />} onClick={updates.openReleasePage}>
              Open release page
            </Button>
          </div>
        )}
        {updates.checkNowState && view !== 'perform' && (
          <p role="status" className={styles.checkNow}>
            {CHECK_NOW_MESSAGES[updates.checkNowState]}
          </p>
        )}
        {updates.enabled !== undefined && (
          <>
            <Button
              variant="ghost"
              icon={<RefreshCw aria-hidden />}
              className={styles.action}
              disabled={updates.checkNowState === 'checking'}
              onClick={updates.checkNow}
            >
              Check for updates
            </Button>
            <Checkbox
              label="Check on startup"
              className={styles.setting}
              checked={updates.enabled}
              onChange={updates.setEnabled}
            />
          </>
        )}
      </div>
    </nav>
  );
}
