import { useEffect } from 'react';
import type { MidiInputStatus } from '../../../shared/protocol';
import type { Show } from '../../../shared/show';
import { midiWarning, useMidiInput } from '../show/useMidiInput';
import { usePlayback, type PlaybackState } from '../show/usePlayback';
import { useShow } from '../show/useShow';
import { isTextEntry, panelAction, SHORTCUTS, type PanelAction } from './shortcuts';

// Manual control that needs no MIDI: Blackout, the Base Look, the Grand
// Master and the Show's Scene buttons, each with a keyboard shortcut that
// works from any view except while typing in a text field. Stays in view
// above every view, with the MIDI input status.
export function FallbackPanel() {
  const show = useShow().show?.show;
  const playback = usePlayback();
  const midiInput = useMidiInput();

  useEffect(() => {
    if (!show || !playback) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTextEntry(event.target as HTMLElement | null)) return;
      const action = panelAction(event);
      if (!action) return;
      // Keeps a focused list or slider from also taking the key.
      event.preventDefault();
      runPanelAction(action, show, playback);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [show, playback]);

  if (!show || !playback) return <p>Loading Fallback Panel…</p>;
  const baseLook = show.scenes.find((s) => s.id === show.baseLook);
  const scenes = (show.panelScenes ?? []).flatMap(
    (id) => show.scenes.find((s) => s.id === id) ?? [],
  );
  const isActive = (sceneId: string, layer: string) => playback.active[layer] === sceneId;

  return (
    <section
      aria-label="Fallback Panel"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        background: 'Canvas',
        borderBottom: '1px solid',
      }}
    >
      <p>
        <button
          type="button"
          aria-pressed={playback.blackout}
          onClick={() => runPanelAction({ type: 'blackout' }, show, playback)}
        >
          Blackout [{SHORTCUTS.blackout}]
        </button>{' '}
        <button
          type="button"
          disabled={!baseLook}
          title={baseLook ? undefined : 'Choose a Base Look in the Show view'}
          aria-pressed={baseLook ? isActive(baseLook.id, baseLook.layer) : false}
          onClick={() => runPanelAction({ type: 'baseLook' }, show, playback)}
        >
          Base Look{baseLook && `: ${baseLook.name}`} [{SHORTCUTS.baseLook}]
        </button>{' '}
        <label>
          Grand Master [{SHORTCUTS.grandMasterDown} {SHORTCUTS.grandMasterUp}]{' '}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={playback.grandMaster}
            onChange={(e) =>
              window.engine.send({ type: 'setGrandMaster', level: Number(e.target.value) })
            }
          />{' '}
          {Math.round(playback.grandMaster * 100)}%
        </label>
        {playback.blackout && <strong> Blackout is on.</strong>}
      </p>
      <p>
        {scenes.length === 0
          ? 'No Scene buttons: add them in the Show view.'
          : scenes.map((scene, i) => (
              <button
                key={scene.id}
                type="button"
                aria-pressed={isActive(scene.id, scene.layer)}
                onClick={() => runPanelAction({ type: 'scene', index: i }, show, playback)}
              >
                {scene.name} [{i + 1}]
              </button>
            ))}
      </p>
      <MidiStatus status={midiInput} />
    </section>
  );
}

function runPanelAction(action: PanelAction, show: Show, playback: PlaybackState): void {
  switch (action.type) {
    case 'blackout':
      window.engine.send({ type: 'setBlackout', on: !playback.blackout });
      break;
    case 'baseLook':
      window.engine.send({ type: 'goBaseLook' });
      break;
    case 'scene': {
      const sceneId = show.panelScenes?.[action.index];
      if (sceneId !== undefined) window.engine.send({ type: 'goScene', sceneId });
      break;
    }
    case 'grandMaster': {
      // Rounded, so steps land on whole percentages.
      const level = Math.round((playback.grandMaster + action.step) * 100) / 100;
      window.engine.send({ type: 'setGrandMaster', level });
      break;
    }
  }
}

// Triggers do not fire while a warning shows.
function MidiStatus({ status }: { status: MidiInputStatus | undefined }) {
  const warning = midiWarning(status);
  if (warning) return <p role="alert">{warning}</p>;
  if (!status) return <p>MIDI input: waiting for engine…</p>;
  if (status.state === 'connected') return <p>MIDI input: listening to {status.selected}.</p>;
  return <p>MIDI input: none selected. Choose one in the Show view.</p>;
}
