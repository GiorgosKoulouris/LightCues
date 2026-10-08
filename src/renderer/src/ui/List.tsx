import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from './List.module.css';
import { cx } from './cx';

// How an item was picked: Shift asks for a range, Ctrl (Cmd) for a toggle.
export interface SelectModifiers {
  range: boolean;
  toggle: boolean;
}

// Shift and Ctrl (Cmd on a Mac) from a click.
export function selectModifiers(event: {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): SelectModifiers {
  return { range: event.shiftKey, toggle: event.ctrlKey || event.metaKey };
}

interface ListProps<T> {
  label: string;
  items: readonly T[];
  getKey: (item: T) => string;
  // The current item, which the arrow keys move from.
  selectedKey?: string;
  // Set for a list where several items can be selected.
  selectedKeys?: readonly string[];
  onSelect: (key: string, modifiers: SelectModifiers) => void;
  // A heading to list each item under; items of one group must be adjacent.
  group?: (item: T) => string;
  // Enter or double-click on an item.
  onActivate?: (key: string) => void;
  // Del while a listed item is selected; one hidden, as by a search, is not.
  onDelete?: () => void;
  renderItem: (item: T, selected: boolean) => ReactNode;
  empty?: ReactNode;
  // Keys the list does not handle itself.
  onKeyDown?: (event: KeyboardEvent<HTMLUListElement>) => void;
  className?: string;
}

// The index a navigation key moves to, or undefined for other keys.
function listIndexFor(key: string, current: number, count: number): number | undefined {
  const last = count - 1;
  switch (key) {
    case 'ArrowDown':
      return current < 0 ? 0 : Math.min(current + 1, last);
    case 'ArrowUp':
      return current < 0 ? last : Math.max(current - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return undefined;
  }
}

// A list box. It is one tab stop; the arrow keys, Home and End move the
// selection, Enter activates the selected item and Del deletes it. With `selectedKeys`,
// several items show as selected and the caller handles Shift and Ctrl.
export function List<T>({
  label,
  items,
  getKey,
  selectedKey,
  selectedKeys,
  onSelect,
  group,
  onActivate,
  onDelete,
  renderItem,
  empty,
  onKeyDown,
  className,
}: ListProps<T>) {
  const id = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const optionId = (key: string) => `${id}-${key}`;
  const selectedIndex = items.findIndex((item) => getKey(item) === selectedKey);
  const activeId = selectedIndex >= 0 ? optionId(getKey(items[selectedIndex]!)) : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const index =
      items.length > 0 ? listIndexFor(event.key, selectedIndex, items.length) : undefined;
    if (index !== undefined) {
      event.preventDefault();
      onSelect(getKey(items[index]!), { range: event.shiftKey, toggle: false });
    } else if (event.key === 'Enter' && selectedKey !== undefined && selectedIndex >= 0) {
      event.preventDefault();
      onActivate?.(selectedKey);
    } else if (event.key === 'Delete' && onDelete && listsSelected()) {
      event.preventDefault();
      onDelete();
    } else {
      onKeyDown?.(event);
    }
  };

  function listsSelected(): boolean {
    if (!selectedKeys) return selectedIndex >= 0;
    return items.some((item) => selectedKeys.includes(getKey(item)));
  }

  if (items.length === 0 && empty) {
    return <div className={cx(styles.empty, className)}>{empty}</div>;
  }

  const renderOption = (item: T) => {
    const key = getKey(item);
    const selected = selectedKeys ? selectedKeys.includes(key) : key === selectedKey;
    return (
      <li
        key={key}
        id={optionId(key)}
        role="option"
        aria-selected={selected}
        className={cx(styles.option, selected && styles.selected)}
        onMouseDown={(event) => {
          // Keep focus on the list, not the option.
          event.preventDefault();
          listRef.current?.focus();
        }}
        onClick={(event) => onSelect(key, selectModifiers(event))}
        onDoubleClick={() => onActivate?.(key)}
      >
        {renderItem(item, selected)}
      </li>
    );
  };

  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label={label}
      aria-multiselectable={selectedKeys ? true : undefined}
      aria-activedescendant={activeId}
      tabIndex={0}
      className={cx(styles.list, className)}
      onKeyDown={handleKeyDown}
    >
      {group
        ? groupItems(items, group).map(([heading, members], index) => (
            <li key={heading} role="presentation">
              <span id={`${id}-group-${index}`} className={styles.groupHeading}>
                {heading}
              </span>
              <ul role="group" aria-labelledby={`${id}-group-${index}`} className={styles.group}>
                {members.map(renderOption)}
              </ul>
            </li>
          ))
        : items.map(renderOption)}
    </ul>
  );
}

// Adjacent items with the same group, in order.
function groupItems<T>(items: readonly T[], group: (item: T) => string): [string, T[]][] {
  const groups: [string, T[]][] = [];
  for (const item of items) {
    const heading = group(item);
    const last = groups.at(-1);
    if (last?.[0] === heading) last[1].push(item);
    else groups.push([heading, [item]]);
  }
  return groups;
}
