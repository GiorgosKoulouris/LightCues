import { PanelRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from './Button';
import { cx } from './cx';
import styles from './SidePanel.module.css';

interface SidePanelProps {
  label: string;
  // Open over the view, below 1280px.
  open: boolean;
  onClose(): void;
  className?: string;
  children: ReactNode;
}

// A view's right column. Below 1280px it is hidden, and opens over the view
// from its `SidePanelToggle`; Esc inside it closes it, unless a control took
// the Esc. The view sets `--side-width` and is positioned, with the column's
// top at `--space-3`.
export function SidePanel({ label, open, onClose, className, children }: SidePanelProps) {
  return (
    <aside
      aria-label={label}
      className={cx(styles.panel, open && styles.open, className)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open && !event.defaultPrevented) onClose();
      }}
    >
      {children}
    </aside>
  );
}

// Shows or hides the `SidePanel`; only shown below 1280px.
export function SidePanelToggle({
  label,
  open,
  onToggle,
}: {
  // The panel's name, as in "Show inspector".
  label: string;
  open: boolean;
  onToggle(): void;
}) {
  return (
    <IconButton
      icon={<PanelRight />}
      label={`${open ? 'Hide' : 'Show'} ${label}`}
      aria-expanded={open}
      className={styles.toggle}
      onClick={onToggle}
    />
  );
}
