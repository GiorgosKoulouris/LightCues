import { Settings2, X } from 'lucide-react';
import type { ShowEdit } from '../../../shared/protocol';
import { DEFAULT_DIRECTION, DIRECTIONS, MAX_PANEL_SCENES, type Show } from '../../../shared/show';
import { Button, IconButton } from '../ui/Button';
import { Popover } from '../ui/Popover';
import { Select } from '../ui/Select';
import { moveItem, SortableList } from '../ui/SortableList';
import { ColourPicker } from './ColourPicker';
import { sceneName } from './scenes';
import styles from './ShowSettings.module.css';

// The Show-wide settings, in a popover from the view header: Base Look,
// Default Colour, Default Direction and the Fallback Panel's Scene buttons in
// drag order.
export function ShowSettings({ show, onEdit }: { show: Show; onEdit(edit: ShowEdit): void }) {
  const panelScenes = show.panelScenes ?? [];
  const nameOf = (id: string) => sceneName(show, id);
  const setPanelScenes = (sceneIds: string[]) => onEdit({ type: 'setPanelScenes', sceneIds });
  const full = panelScenes.length >= MAX_PANEL_SCENES;
  const addable = show.scenes.filter((s) => !panelScenes.includes(s.id));

  return (
    <Popover
      label="Show settings"
      align="end"
      trigger={<Button icon={<Settings2 />}>Show settings</Button>}
    >
      <div className={styles.settings}>
        <Select
          label="Base Look"
          value={show.baseLook ?? ''}
          options={[
            { value: '', label: 'None' },
            ...show.scenes.map((s) => ({ value: s.id, label: s.name })),
          ]}
          onChange={(sceneId) => onEdit({ type: 'setBaseLook', sceneId: sceneId || undefined })}
        />
        <ColourPicker
          label="Default Colour"
          unset="White"
          colour={show.defaultColour}
          onChange={(colour) => onEdit({ type: 'setDefaultColour', colour })}
        />
        <Select
          label="Default Direction"
          value={show.defaultDirection ?? DEFAULT_DIRECTION}
          options={DIRECTIONS.map((d) => ({ value: d, label: d }))}
          onChange={(direction) => onEdit({ type: 'setDefaultDirection', direction })}
        />
        <section className={styles.panel} aria-label="Fallback Panel Scenes">
          <h3 className={styles.heading}>Fallback Panel Scenes</h3>
          <p className={styles.hint}>
            On keys 1–{MAX_PANEL_SCENES}, in this order. Drag to reorder.
          </p>
          {panelScenes.length > 0 && (
            <SortableList
              label="Fallback Panel Scenes"
              items={panelScenes}
              getKey={(id) => id}
              itemLabel={nameOf}
              onMove={(from, to) => setPanelScenes(moveItem(panelScenes, from, to))}
              itemClassName={styles.item}
              renderItem={(id, i, handle) => (
                <>
                  {handle}
                  <kbd className={styles.key}>{i + 1}</kbd>
                  <span className={styles.name}>{nameOf(id)}</span>
                  <IconButton
                    icon={<X />}
                    label={`Remove ${nameOf(id)} from the panel`}
                    tooltip={false}
                    onClick={() => setPanelScenes(panelScenes.filter((s) => s !== id))}
                  />
                </>
              )}
            />
          )}
          <Select
            label="Add a Scene"
            hideLabel
            value=""
            disabled={full || addable.length === 0}
            options={[
              { value: '', label: full ? `The panel holds ${MAX_PANEL_SCENES}` : 'Add a Scene…' },
              ...addable.map((s) => ({ value: s.id, label: s.name })),
            ]}
            onChange={(id) => {
              if (id !== '') setPanelScenes([...panelScenes, id]);
            }}
          />
        </section>
      </div>
    </Popover>
  );
}
