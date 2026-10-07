import { useEffect, useState } from 'react';
import type { PlaybackMode } from '../../../shared/protocol';
import { MAX_PANEL_SCENES, type Layer, type Scene, type Show } from '../../../shared/show';
import { useVenuePatch } from '../venue/useVenuePatch';
import { ColourPicker } from './ColourPicker';
import { Preview } from './Preview';
import { SceneEditor } from './SceneEditor';
import { TriggerPanel } from './TriggerPanel';
import { useMidiInput } from './useMidiInput';
import { usePlayback, type PlaybackState } from './usePlayback';
import { useShow } from './useShow';

// Edits the current Show: file, Layers, Scenes and MIDI Triggers. Scenes go
// live from here with Go; Clear empties a Layer. In Blind, the Outputs hold
// their last frame while the preview keeps showing the resolved look.
export function ShowView() {
  const { show: state, edit, newShow, open, save } = useShow();
  const { venue } = useVenuePatch();
  const playback = usePlayback();
  const midiInput = useMidiInput();
  const [selectedId, setSelectedId] = useState<string>();
  const [tag, setTag] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  // Tells main whether closing the window would lose changes.
  const unsaved = state?.unsaved ?? false;
  useEffect(() => window.closeGuard.setUnsaved('show', unsaved), [unsaved]);

  // Save chosen when closing the window. Cancelling the file dialog keeps
  // the window open.
  useEffect(
    () =>
      window.closeGuard.onSaveBeforeClose('show', async () => {
        const result = await save().catch((error: Error) => [`Save failed: ${error.message}`]);
        if (result) setErrors(result);
        return result?.length === 0;
      }),
    [save],
  );

  if (!state || !venue || !playback) return <p>Loading Show…</p>;
  const { show, path } = state;
  const selected = show.scenes.find((s) => s.id === selectedId);
  const tags = [...new Set(show.scenes.flatMap((s) => s.tags))].sort();
  const listed = tag === '' ? show.scenes : show.scenes.filter((s) => s.tags.includes(tag));
  const panelScenes = show.panelScenes ?? [];

  // Runs a change and shows its errors, or clears them when it worked. A
  // change resolving to undefined was cancelled and leaves them.
  async function run(change: () => Promise<string[] | undefined>): Promise<boolean> {
    let result: string[] | undefined;
    try {
      result = await change();
    } catch (error) {
      result = [(error as Error).message];
    }
    if (result === undefined) return false;
    setErrors(result);
    return result.length === 0;
  }

  function discardUnsaved(): boolean {
    return !unsaved || window.confirm('The Show has unsaved changes. Discard them?');
  }

  function addScene() {
    const scene: Scene = {
      id: freeId('scene', show.scenes),
      name: `Scene ${show.scenes.length + 1}`,
      tags: tag === '' ? [] : [tag],
      layer: show.layers[0]!.id,
      fadeIn: 0,
      rules: [{ target: {}, intensity: 1 }],
    };
    void run(() => edit({ type: 'putScene', scene })).then((done) => {
      if (done) setSelectedId(scene.id);
    });
  }

  function removeScene(scene: Scene) {
    const triggers = show.triggers.filter((t) => t.scene === scene.id).length;
    const also = triggers > 0 ? ` Its ${triggers} Trigger(s) are removed too.` : '';
    if (!window.confirm(`Remove ${scene.name}?${also}`)) return;
    setSelectedId(undefined);
    void run(() => edit({ type: 'removeScene', id: scene.id }));
  }

  // Adds a Scene's button at the end of the Fallback Panel, or removes it.
  function togglePanelScene(scene: Scene, on: boolean) {
    const sceneIds = on ? [...panelScenes, scene.id] : panelScenes.filter((id) => id !== scene.id);
    void run(() => edit({ type: 'setPanelScenes', sceneIds }));
  }

  function removeLayer(layer: Layer) {
    const scenes = show.scenes.filter((s) => s.layer === layer.id);
    const message =
      scenes.length > 0
        ? `${layer.name} has ${scenes.length} Scene(s): ` +
          `${scenes.map((s) => s.name).join(', ')}. Remove the Layer and its Scenes?`
        : `Remove ${layer.name}?`;
    if (!window.confirm(message)) return;
    void run(() => edit({ type: 'removeLayer', id: layer.id }));
  }

  return (
    <section>
      <h2>Show</h2>
      <p>
        {path ?? 'Not saved yet'}
        {unsaved && ' (unsaved changes)'}{' '}
        <button
          type="button"
          onClick={() => {
            if (!discardUnsaved()) return;
            newShow();
            setSelectedId(undefined);
            setErrors([]);
          }}
        >
          New
        </button>
        <button
          type="button"
          onClick={() => {
            if (discardUnsaved()) void run(open);
          }}
        >
          Open…
        </button>
        <button type="button" onClick={() => void run(() => save())}>
          Save
        </button>
        <button type="button" onClick={() => void run(() => save({ as: true }))}>
          Save As…
        </button>
      </p>
      <ModeSwitch mode={playback.mode} />
      <Preview patch={venue.patch} mode={playback.mode} />
      {errors.length > 0 && (
        <ul role="alert">
          {errors.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      <LayerList
        show={show}
        playback={playback}
        onAdd={() => {
          const id = freeId('layer', show.layers);
          const name = `Layer ${show.layers.length + 1}`;
          void run(() => edit({ type: 'putLayer', layer: { id, name } }));
        }}
        onRename={(layer) => void run(() => edit({ type: 'putLayer', layer }))}
        onRemove={removeLayer}
      />
      <section>
        <h3>Scenes</h3>
        <p>
          <label>
            Tag{' '}
            <select value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">All</option>
              {tags.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>{' '}
          <label>
            Base Look{' '}
            <select
              value={show.baseLook ?? ''}
              onChange={(e) => {
                const sceneId = e.target.value || undefined;
                void run(() => edit({ type: 'setBaseLook', sceneId }));
              }}
            >
              <option value="">None</option>
              {show.scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>{' '}
          <button type="button" onClick={addScene}>
            New Scene
          </button>
        </p>
        <ColourPicker
          label="Default colour, where no Rule sets one"
          unset="White"
          colour={show.defaultColour}
          onChange={(colour) => void run(() => edit({ type: 'setDefaultColour', colour }))}
        />
        <table>
          <thead>
            <tr>
              <th>Scene</th>
              <th>Tags</th>
              <th>Layer</th>
              <th>Fade-in</th>
              <th>Fallback Panel</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {listed.map((scene) => {
              const live = playback.active[scene.layer] === scene.id;
              return (
                <tr key={scene.id}>
                  <td>
                    <button
                      type="button"
                      aria-pressed={scene.id === selectedId}
                      onClick={() => setSelectedId(scene.id)}
                    >
                      {scene.name}
                    </button>
                    {live && ' (active)'}
                  </td>
                  <td>{scene.tags.join(', ')}</td>
                  <td>{layerName(show, scene.layer)}</td>
                  <td>{scene.fadeIn} s</td>
                  <td>
                    <PanelButton
                      position={panelScenes.indexOf(scene.id)}
                      full={panelScenes.length >= MAX_PANEL_SCENES}
                      onChange={(on) => togglePanelScene(scene, on)}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => window.engine.send({ type: 'goScene', sceneId: scene.id })}
                    >
                      Go
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <TriggerPanel
        show={show}
        status={midiInput}
        onPut={(trigger) => void run(() => edit({ type: 'putTrigger', trigger }))}
        onRemove={(note) => void run(() => edit({ type: 'removeTrigger', note }))}
      />
      {selected && (
        <>
          <SceneEditor
            key={selected.id}
            scene={selected}
            show={show}
            patch={venue.patch}
            onPut={(scene) => void run(() => edit({ type: 'putScene', scene }))}
          />
          <button type="button" onClick={() => removeScene(selected)}>
            Remove Scene
          </button>
        </>
      )}
    </section>
  );
}

// Whether a Scene has a Fallback Panel button, and which: `position` is its
// index there, or -1. A full panel takes no more.
function PanelButton({
  position,
  full,
  onChange,
}: {
  position: number;
  full: boolean;
  onChange(on: boolean): void;
}) {
  const on = position >= 0;
  return (
    <label title={!on && full ? `The panel holds ${MAX_PANEL_SCENES} Scenes` : undefined}>
      <input
        type="checkbox"
        checked={on}
        disabled={!on && full}
        onChange={(e) => onChange(e.target.checked)}
      />
      {on && ` key ${position + 1}`}
    </label>
  );
}

function ModeSwitch({ mode }: { mode: PlaybackMode }) {
  const modes: Record<PlaybackMode, string> = { monitor: 'Monitor', blind: 'Blind' };
  return (
    <p>
      {(Object.keys(modes) as PlaybackMode[]).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => window.engine.send({ type: 'setMode', mode: m })}
        >
          {modes[m]}
        </button>
      ))}{' '}
      {mode === 'blind'
        ? 'Blind: the rig holds its last look; changes are not sent, except Blackout.'
        : 'Monitor: changes are sent to the rig.'}
    </p>
  );
}

function LayerList({
  show,
  playback,
  onAdd,
  onRename,
  onRemove,
}: {
  show: Show;
  playback: PlaybackState;
  onAdd(): void;
  onRename(layer: Layer): void;
  onRemove(layer: Layer): void;
}) {
  return (
    <section>
      <h3>Layers</h3>
      <table>
        <thead>
          <tr>
            <th>Layer</th>
            <th>Active Scene</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {show.layers.map((layer) => {
            const active = show.scenes.find((s) => s.id === playback.active[layer.id]);
            return (
              <tr key={layer.id}>
                <td>
                  <LayerName key={layer.name} layer={layer} onRename={onRename} />
                </td>
                <td>{active?.name ?? '—'}</td>
                <td>
                  <button
                    type="button"
                    disabled={!active}
                    onClick={() => window.engine.send({ type: 'clearLayer', layerId: layer.id })}
                  >
                    Clear
                  </button>
                  <button type="button" onClick={() => onRemove(layer)}>
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button type="button" onClick={onAdd}>
        Add Layer
      </button>
    </section>
  );
}

// Renames on blur or Enter. Key it by name, so it shows the engine's.
function LayerName({ layer, onRename }: { layer: Layer; onRename(layer: Layer): void }) {
  const [name, setName] = useState(layer.name);
  const commit = () => {
    if (name !== layer.name) onRename({ ...layer, name });
  };
  return (
    <input
      value={name}
      aria-label="Layer name"
      onChange={(e) => setName(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    />
  );
}

function layerName(show: Show, id: string): string {
  return show.layers.find((l) => l.id === id)?.name ?? id;
}

// `<prefix>-<n>` with the lowest n no item uses.
function freeId(prefix: string, items: { id: string }[]): string {
  let n = 1;
  while (items.some((item) => item.id === `${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}
