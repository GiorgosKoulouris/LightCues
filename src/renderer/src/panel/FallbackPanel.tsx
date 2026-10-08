import type { Show } from '../../../shared/show';
import { isActive } from '../show/scenes';
import type { PlaybackState } from '../show/usePlayback';
import { Button } from '../ui/Button';
import { cx } from '../ui/cx';
import {
  BaseLookButton,
  BlackoutButton,
  FreezeButton,
  GrandMasterFader,
  Key,
  TapTempoButton,
} from './controls';
import styles from './FallbackPanel.module.css';
import { runPanelAction } from './usePanelKeys';
import type { TempoState } from './useTempo';

interface FallbackPanelProps {
  show: Show | undefined;
  playback: PlaybackState | undefined;
  tempo: TempoState | undefined;
}

// Manual control that needs no MIDI: Blackout, the Base Look, the Grand
// Master, Tap Tempo, Freeze and the Show's Scene buttons, each showing its keyboard shortcut
// (`usePanelKeys`). Docked as a strip below every view but Perform; red while
// Blackout is on.
export function FallbackPanel({ show, playback, tempo }: FallbackPanelProps) {
  if (!show || !playback) {
    return (
      <section aria-label="Fallback Panel" className={styles.strip}>
        <p className={styles.note}>Loading Fallback Panel…</p>
      </section>
    );
  }
  const scenes = (show.panelScenes ?? []).flatMap(
    (id) => show.scenes.find((s) => s.id === id) ?? [],
  );

  return (
    <section
      aria-label="Fallback Panel"
      className={cx(styles.strip, playback.blackout && styles.blackout)}
    >
      <BlackoutButton show={show} playback={playback} />
      <BaseLookButton show={show} playback={playback} className={styles.baseLook} />
      <GrandMasterFader playback={playback} />
      <TapTempoButton tempo={tempo} />
      <FreezeButton show={show} playback={playback} />
      <div className={styles.scenes} role="group" aria-label="Scene buttons">
        {scenes.length === 0 ? (
          <p className={styles.note}>No Scene buttons: add them in the Show view.</p>
        ) : (
          scenes.map((scene, i) => (
            <Button
              key={scene.id}
              size="lg"
              aria-pressed={isActive(playback.active, scene)}
              onClick={() => runPanelAction({ type: 'scene', index: i }, show, playback)}
            >
              {scene.name} <Key>{i + 1}</Key>
            </Button>
          ))
        )}
      </div>
    </section>
  );
}
