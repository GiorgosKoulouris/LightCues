import { useRef, useState } from 'react';
import type { ShowEdit } from '../../../shared/protocol';
import type { Scene, Show } from '../../../shared/show';
import { FileButtons } from '../shell/FileButtons';
import { HistoryButtons } from '../shell/HistoryButtons';
import { useFileCommands } from '../shell/useFileCommands';
import { useFileShortcuts, useFindShortcut, useHistoryShortcuts } from '../shell/useShortcuts';
import { plural } from '../ui/plural';
import { removedMessage } from '../ui/removed';
import { SidePanel, SidePanelToggle } from '../ui/SidePanel';
import { Tabs } from '../ui/Tabs';
import { useToast } from '../ui/Toast';
import { useVenuePatch } from '../venue/useVenuePatch';
import { LayerStack } from './LayerStack';
import { ModeSwitch } from './ModeSwitch';
import { Preview } from './Preview';
import { SceneEditor } from './SceneEditor';
import { SceneList } from './SceneList';
import { filterScenes, freeId, sceneTags, type SceneFilter } from './scenes';
import { ShowSettings } from './ShowSettings';
import styles from './ShowView.module.css';
import { TriggerPanel } from './TriggerPanel';
import { useMidiInput } from './useMidiInput';
import { usePlayback } from './usePlayback';
import { useShow } from './useShow';

type SubTab = 'scenes' | 'triggers';

const TABS = [
  { value: 'scenes', label: 'Scenes' },
  { value: 'triggers', label: 'Triggers' },
] as const;

// Edits the current Show. Scenes: the Scene list, the selected Scene's editor,
// and the Preview with the Layer stack. Triggers: MIDI Triggers and the MIDI
// Input. Scenes go live from here with Go; Clear empties a Layer. Removing
// is instant, and undone with Undo. While `active`, Ctrl+N, O, S and Shift+S
// act on its file, Ctrl+Z and Ctrl+Shift+Z undo and redo, and Ctrl+F searches
// the Scenes.
export function ShowView({ active }: { active: boolean }) {
  const { show: state, edit, newShow, undo, redo, open, save } = useShow();
  const { venue } = useVenuePatch();
  const playback = usePlayback();
  const midiInput = useMidiInput();
  const toast = useToast();
  const [tab, setTab] = useState<SubTab>('scenes');
  const [selectedId, setSelectedId] = useState<string>();
  const [filter, setFilter] = useState<SceneFilter>({ query: '' });
  // The Preview column, below 1280px where it is hidden by default.
  const [sideOpen, setSideOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { run, fileCommands } = useFileCommands({
    kind: 'show',
    name: 'Show',
    unsaved: state?.unsaved,
    newFile: newShow,
    open,
    save,
    onReplaced: () => setSelectedId(undefined),
  });
  useFileShortcuts(active, fileCommands);
  useHistoryShortcuts(active, { undo, redo });
  useFindShortcut(active && tab === 'scenes', () => {
    searchRef.current?.focus();
    searchRef.current?.select();
  });

  if (!state || !fileCommands || !venue || !playback) {
    return <p className={styles.loading}>Loading Show…</p>;
  }
  const { show } = state;
  const change = (showEdit: ShowEdit) => run(() => edit(showEdit));
  const go = (sceneId: string) => window.engine.send({ type: 'goScene', sceneId });

  const tags = sceneTags(show.scenes);
  // A tag no Scene has any more filters nothing.
  const tag = filter.tag !== undefined && tags.includes(filter.tag) ? filter.tag : undefined;
  const listed = filterScenes(show.scenes, { ...filter, tag });
  const selected = show.scenes.find((s) => s.id === selectedId);

  function addScene() {
    const scene: Scene = {
      id: freeId('scene', show.scenes),
      name: `Scene ${show.scenes.length + 1}`,
      tags: tag === undefined ? [] : [tag],
      layer: show.layers[0]!.id,
      fadeIn: 0,
      rules: [{ target: {}, intensity: 1 }],
    };
    void change({ type: 'putScene', scene }).then((done) => {
      if (done) setSelectedId(scene.id);
    });
  }

  // Selects the next listed Scene, and tells what else went.
  async function removeScene(id: string) {
    const scene = show.scenes.find((s) => s.id === id);
    if (!scene) return;
    const index = listed.findIndex((s) => s.id === id);
    const next = listed[index + 1] ?? listed[index - 1];
    if (!(await change({ type: 'removeScene', id }))) return;
    setSelectedId(next?.id);
    toast({ message: removedSceneMessage(show, scene) });
  }

  return (
    <Tabs
      label="Show"
      tabs={TABS}
      value={tab}
      onChange={setTab}
      className={styles.view}
      actions={
        <>
          {tab === 'scenes' && (
            <SidePanelToggle
              label="Preview and Layers"
              open={sideOpen}
              onToggle={() => setSideOpen(!sideOpen)}
            />
          )}
          <ShowSettings show={show} onEdit={(showEdit) => void change(showEdit)} />
          <HistoryButtons
            commands={{ undo, redo }}
            enabled={{ undo: state.canUndo, redo: state.canRedo }}
          />
          <FileButtons commands={fileCommands} />
        </>
      }
    >
      {tab === 'scenes' ? (
        <div className={styles.scenes}>
          <SceneList
            show={show}
            scenes={listed}
            tags={tags}
            filter={{ ...filter, tag }}
            active={playback.active}
            selectedId={selectedId}
            searchRef={searchRef}
            onFilter={setFilter}
            onSelect={setSelectedId}
            onGo={go}
            onRemove={(id) => void removeScene(id)}
            onNew={addScene}
          />
          {selected ? (
            <SceneEditor
              key={selected.id}
              scene={selected}
              show={show}
              patch={venue.patch}
              onPut={(scene) => change({ type: 'putScene', scene })}
              onGo={() => go(selected.id)}
              onRemove={() => void removeScene(selected.id)}
            />
          ) : (
            <p className={styles.empty}>Select a Scene to edit it, or add a New Scene.</p>
          )}
          <SidePanel
            label="Preview and Layers"
            open={sideOpen}
            onClose={() => setSideOpen(false)}
            className={styles.side}
          >
            <div className={styles.previewBar}>
              <h3 className={styles.heading}>Preview</h3>
              <ModeSwitch mode={playback.mode} />
            </div>
            <Preview patch={venue.patch} />
            <LayerStack
              show={show}
              active={playback.active}
              onAdd={() => {
                const id = freeId('layer', show.layers);
                const name = `Layer ${show.layers.length + 1}`;
                void change({ type: 'putLayer', layer: { id, name } });
              }}
              onRename={(layer) => void change({ type: 'putLayer', layer })}
              onRemove={(layer) => change({ type: 'removeLayer', id: layer.id })}
            />
          </SidePanel>
        </div>
      ) : (
        <TriggerPanel
          show={show}
          status={midiInput}
          onPut={(trigger) => void change({ type: 'putTrigger', trigger })}
          onRemove={(note) => change({ type: 'removeTrigger', note })}
        />
      )}
    </Tabs>
  );
}

// The removed Scene and what went with it, from the Show before.
function removedSceneMessage(show: Show, { id, name }: Scene): string {
  const triggers = show.triggers.filter((t) => t.scene === id).length;
  const also = [
    triggers > 0 && `its ${plural(triggers, 'Trigger')}`,
    show.baseLook === id && 'the Base Look',
    show.panelScenes?.includes(id) && 'its Fallback Panel button',
  ].filter((part) => typeof part === 'string');
  return removedMessage(name, also);
}
