import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import styles from './SortableList.module.css';
import { cx } from './cx';

interface SortableListProps<T> {
  label: string;
  items: readonly T[];
  // Unique in the list.
  getKey: (item: T, index: number) => string;
  // Names an item for its handle and screen reader announcements.
  itemLabel: (item: T, index: number) => string;
  // Moves the item at `from` to `to`.
  onMove: (from: number, to: number) => void;
  // `handle` is the drag handle; place it in the item.
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode;
  itemClassName?: string;
}

// The pointer must move this far before a drag starts, so clicks still work.
const DRAG_DISTANCE = 4;

// An ordered list reordered by dragging an item's handle, with the mouse or
// the keyboard: Space picks up, the arrow keys move, Space drops, Esc cancels.
export function SortableList<T>({
  label,
  items,
  getKey,
  itemLabel,
  onMove,
  renderItem,
  itemClassName,
}: SortableListProps<T>) {
  const keys = items.map(getKey);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const nameOf = (key: UniqueIdentifier) => {
    const index = keys.indexOf(String(key));
    return index >= 0 ? itemLabel(items[index]!, index) : String(key);
  };
  const position = (key: UniqueIdentifier) => keys.indexOf(String(key)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is at position ${position(over.id)} of ${keys.length}.` : '',
    onDragEnd: ({ active, over }) =>
      over ? `Dropped ${nameOf(active.id)} at position ${position(over.id)}.` : '',
    onDragCancel: ({ active }) => `Cancelled. ${nameOf(active.id)} was not moved.`,
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onMove(keys.indexOf(String(active.id)), keys.indexOf(String(over.id)));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={keys} strategy={verticalListSortingStrategy}>
        <ol aria-label={label} className={styles.list}>
          {items.map((item, index) => (
            <SortableItem
              key={keys[index]}
              id={keys[index]!}
              label={itemLabel(item, index)}
              className={itemClassName}
            >
              {(handle) => renderItem(item, index, handle)}
            </SortableItem>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

// A copy of `items` with the item at `from` moved to `to`.
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

// Keys for `count` items that have no ids of their own, such as Rules. Call
// `move` and `remove` alongside the change, so a key, and with it focus and
// state, stays with its item. When the count changes otherwise, keys are added
// or dropped at the end.
export function useItemKeys(count: number) {
  const [state, setState] = useState(() => ({ keys: numbered(0, count), next: count }));

  let current = state;
  if (state.keys.length !== count) {
    const missing = count - state.keys.length;
    current =
      missing > 0
        ? { keys: [...state.keys, ...numbered(state.next, missing)], next: state.next + missing }
        : { ...state, keys: state.keys.slice(0, count) };
    setState(current);
  }

  return {
    keys: current.keys,
    move: (from: number, to: number) =>
      setState({ ...current, keys: moveItem(current.keys, from, to) }),
    remove: (index: number) =>
      setState({ ...current, keys: current.keys.filter((_, i) => i !== index) }),
  };
}

function numbered(from: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => String(from + i));
}

function SortableItem({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const handle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      className={styles.handle}
      {...attributes}
      {...listeners}
      aria-label={`Move ${label}`}
    >
      <GripVertical aria-hidden />
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      className={cx(styles.item, isDragging && styles.dragging, className)}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {children(handle)}
    </li>
  );
}
