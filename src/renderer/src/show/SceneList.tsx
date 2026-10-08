import { Play, Plus } from 'lucide-react';
import type { Ref } from 'react';
import type { Scene, Show } from '../../../shared/show';
import type { ActiveByLayer } from '../../../shared/protocol';
import { FIND_SHORTCUT } from '../shell/shortcuts';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cx } from '../ui/cx';
import { SearchField } from '../ui/fields';
import { List } from '../ui/List';
import { ActiveDot } from './ActiveDot';
import styles from './SceneList.module.css';
import { isActive, layerName, type SceneFilter } from './scenes';

interface SceneListProps {
  show: Show;
  // The Scenes the search and tag leave, in Show order.
  scenes: Scene[];
  tags: string[];
  filter: SceneFilter;
  active: ActiveByLayer;
  selectedId: string | undefined;
  searchRef: Ref<HTMLInputElement>;
  onFilter(filter: SceneFilter): void;
  onSelect(id: string): void;
  onGo(id: string): void;
  onRemove(id: string): void;
  onNew(): void;
}

// The Show's Scenes, searched by name and filtered by a tag chip. Arrow keys
// select, Enter goes to the selected Scene, Del removes it.
export function SceneList({
  show,
  scenes,
  tags,
  filter,
  active,
  selectedId,
  searchRef,
  onFilter,
  onSelect,
  onGo,
  onRemove,
  onNew,
}: SceneListProps) {
  const { tag } = filter;
  const onTag = (next: string | undefined) => onFilter({ ...filter, tag: next });
  return (
    <div className={styles.column}>
      <SearchField
        label="Search Scenes"
        placeholder={`Search Scenes (${FIND_SHORTCUT})`}
        inputRef={searchRef}
        value={filter.query}
        onChange={(query) => onFilter({ ...filter, query })}
      />
      {tags.length > 0 && (
        <div role="group" aria-label="Tags" className={styles.chips}>
          <Chip label="All" on={tag === undefined} onClick={() => onTag(undefined)} />
          {tags.map((t) => (
            <Chip
              key={t}
              label={t}
              on={tag === t}
              onClick={() => onTag(tag === t ? undefined : t)}
            />
          ))}
        </div>
      )}
      <List
        label="Scenes"
        items={scenes}
        getKey={(scene) => scene.id}
        selectedKey={selectedId}
        onSelect={onSelect}
        onActivate={onGo}
        onDelete={() => selectedId !== undefined && onRemove(selectedId)}
        className={styles.list}
        empty={show.scenes.length === 0 ? 'No Scenes yet' : 'No Scenes match'}
        renderItem={(scene) => (
          <>
            <ActiveDot on={isActive(active, scene)} />
            <span data-testid="name" className={styles.name}>
              {scene.name}
            </span>
            <Badge className={styles.layer}>{layerName(show, scene.layer)}</Badge>
            <button
              type="button"
              // The list is the tab stop; Enter goes from the keyboard.
              tabIndex={-1}
              aria-label={`Go ${scene.name}`}
              className={styles.go}
              onClick={() => onGo(scene.id)}
            >
              <Play aria-hidden />
            </button>
          </>
        )}
      />
      <Button icon={<Plus />} onClick={onNew}>
        New Scene
      </Button>
    </div>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cx(styles.chip, on && styles.chipOn)}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
