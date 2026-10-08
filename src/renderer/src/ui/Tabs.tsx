import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Tabs.module.css';
import { cx } from './cx';

export interface Tab<V extends string> {
  value: V;
  label: ReactNode;
}

interface TabsProps<V extends string> {
  label: string;
  tabs: readonly Tab<V>[];
  value: V;
  onChange: (value: V) => void;
  // Shown at the end of the tab row, such as a view's buttons.
  actions?: ReactNode;
  // The selected tab's content.
  children: ReactNode;
  className?: string;
}

// The index a key moves to, wrapping at the ends, or undefined for other keys.
function tabIndexFor(key: string, current: number, count: number): number | undefined {
  switch (key) {
    case 'ArrowRight':
      return (current + 1) % count;
    case 'ArrowLeft':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return undefined;
  }
}

// Tabs that select as focus moves. Left/Right, Home and End move between tabs.
export function Tabs<V extends string>({
  label,
  tabs,
  value,
  onChange,
  actions,
  children,
  className,
}: TabsProps<V>) {
  const id = useId();
  const tabRefs = useRef(new Map<V, HTMLButtonElement>());
  const tabId = (tab: V) => `${id}-tab-${tab}`;
  const panelId = `${id}-panel`;

  const handleKeyDown = (event: KeyboardEvent) => {
    const index = tabs.findIndex((tab) => tab.value === value);
    const next = tabIndexFor(event.key, index, tabs.length);
    if (next === undefined) return;
    event.preventDefault();
    const tab = tabs[next]!.value;
    onChange(tab);
    tabRefs.current.get(tab)?.focus();
  };

  return (
    <div className={cx(styles.tabs, className)}>
      <div className={styles.bar}>
        <div role="tablist" aria-label={label} className={styles.list} onKeyDown={handleKeyDown}>
          {tabs.map((tab) => {
            const selected = tab.value === value;
            return (
              <button
                key={tab.value}
                ref={(element) => {
                  if (element) tabRefs.current.set(tab.value, element);
                  else tabRefs.current.delete(tab.value);
                }}
                type="button"
                role="tab"
                id={tabId(tab.value)}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                className={styles.tab}
                onClick={() => onChange(tab.value)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId(value)}
        tabIndex={0}
        className={styles.panel}
      >
        {children}
      </div>
    </div>
  );
}
