import { Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';
import type { ActiveByLayer } from '../../../shared/protocol';
import type { Layer, Show } from '../../../shared/show';
import { Button, IconButton } from '../ui/Button';
import { parseName, TextField } from '../ui/fields';
import { namedCount, removedMessage } from '../ui/removed';
import { useToast } from '../ui/Toast';
import { ActiveDot } from './ActiveDot';
import { ClearLayerButton } from './ClearLayerButton';
import styles from './LayerStack.module.css';

interface LayerStackProps {
  show: Show;
  active: ActiveByLayer;
  onAdd(): void;
  onRename(layer: Layer): void;
  // Resolves to whether it was removed.
  onRemove(layer: Layer): Promise<boolean>;
}

// The Show's Layers in order, each with its active Scene and Clear. Names
// are edited in place. Removing a Layer tells which of its Scenes went too;
// the last Layer stays.
export function LayerStack({ show, active, onAdd, onRename, onRemove }: LayerStackProps) {
  const toast = useToast();
  const headingId = useId();

  async function remove(layer: Layer) {
    const scenes = show.scenes.filter((s) => s.layer === layer.id);
    if (!(await onRemove(layer))) return;
    const also =
      scenes.length > 0
        ? [
            `its ${namedCount(
              'Scene',
              scenes.map((s) => s.name),
            )}`,
          ]
        : [];
    toast({ message: removedMessage(layer.name, also) });
  }

  return (
    <section aria-labelledby={headingId} className={styles.stack}>
      <div className={styles.bar}>
        <h3 id={headingId} className={styles.heading}>
          Layers
        </h3>
        <Button variant="ghost" icon={<Plus />} onClick={onAdd}>
          Add Layer
        </Button>
      </div>
      <ul aria-label="Layers" className={styles.list}>
        {show.layers.map((layer) => {
          const scene = show.scenes.find((s) => s.id === active[layer.id]);
          return (
            <li key={layer.id} className={styles.layer}>
              <div className={styles.row}>
                <TextField
                  label="Layer name"
                  hideLabel
                  value={layer.name}
                  parse={parseName}
                  onCommit={(name) => onRename({ ...layer, name })}
                />
                <ClearLayerButton layer={layer} active={active} />
                <IconButton
                  icon={<Trash2 />}
                  label={`Remove Layer ${layer.name}`}
                  disabled={show.layers.length === 1}
                  onClick={() => void remove(layer)}
                />
              </div>
              <div className={styles.active}>
                <ActiveDot on={scene !== undefined} />
                {scene ? scene.name : <span className={styles.clear}>Clear</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
