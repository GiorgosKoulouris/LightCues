import type { ReactNode } from 'react';
import type { TempoSource } from '../../../shared/protocol';
import type { Show } from '../../../shared/show';
import { isActive } from '../show/scenes';
import type { PlaybackState } from '../show/usePlayback';
import { Button } from '../ui/Button';
import { cx } from '../ui/cx';
import styles from './controls.module.css';
import { runPanelAction } from './usePanelKeys';
import { SHORTCUTS } from './shortcuts';
import type { TempoState } from './useTempo';

// The Fallback Panel's controls, shared by its strip and the Perform view,
// which sizes them with `className`. The container sets `--wide-control`, the
// width of Blackout and the Grand Master fader.

interface ControlProps {
  show: Show;
  playback: PlaybackState;
  className?: string;
}

// A shortcut key shown on a control.
export function Key({ children }: { children: ReactNode }) {
  return <kbd className={styles.key}>{children}</kbd>;
}

// Turns Blackout on or off; red while on.
export function BlackoutButton({ show, playback, className }: ControlProps) {
  return (
    <Button
      size="lg"
      variant={playback.blackout ? 'danger' : 'secondary'}
      className={cx(styles.blackout, className)}
      aria-pressed={playback.blackout}
      onClick={() => runPanelAction({ type: 'blackout' }, show, playback)}
    >
      Blackout <Key>{SHORTCUTS.blackout}</Key>
    </Button>
  );
}

// Turns Freeze on or off, which holds every movement Effect where it is.
export function FreezeButton({ show, playback, className }: ControlProps) {
  return (
    <Button
      size="lg"
      variant={playback.freeze ? 'primary' : 'secondary'}
      className={cx(styles.freeze, className)}
      aria-pressed={playback.freeze}
      onClick={() => runPanelAction({ type: 'freeze' }, show, playback)}
    >
      Freeze <Key>{SHORTCUTS.freeze}</Key>
    </Button>
  );
}

// Goes to the Base Look, which clears every other Layer. Disabled until the
// Show has one.
export function BaseLookButton({ show, playback, className }: ControlProps) {
  const baseLook = show.scenes.find((s) => s.id === show.baseLook);
  return (
    <Button
      size="lg"
      className={cx(styles.baseLook, className)}
      disabled={!baseLook}
      title={baseLook ? baseLook.name : 'Choose a Base Look in the Show view'}
      aria-pressed={baseLook ? isActive(playback.active, baseLook) : false}
      onClick={() => runPanelAction({ type: 'baseLook' }, show, playback)}
    >
      <span className={styles.name}>Base Look{baseLook && `: ${baseLook.name}`}</span>
      <Key>{SHORTCUTS.baseLook}</Key>
    </Button>
  );
}

const TEMPO_SOURCES: Record<TempoSource, string | undefined> = {
  default: undefined,
  clock: 'Clock',
  held: 'Clock lost',
  tap: 'Tapped',
};

// Tap Tempo, showing the Tempo in whole BPM and whether it comes from the MIDI
// Clock, is held since the clock was lost, or comes from taps. Taps are sent
// as they come; the engine averages them.
export function TapTempoButton({
  tempo,
  className,
}: {
  tempo: TempoState | undefined;
  className?: string;
}) {
  const source = tempo && TEMPO_SOURCES[tempo.source];
  return (
    <Button
      size="lg"
      className={cx(styles.tapTempo, className)}
      onClick={() => window.engine.send({ type: 'tapTempo' })}
    >
      Tap <Key>{SHORTCUTS.tapTempo}</Key>
      {tempo && <span className={styles.bpm}>{Math.round(tempo.bpm)} BPM</span>}
      {source && <span className={styles.source}>{source}</span>}
    </Button>
  );
}

// Scales every Fixture's intensity, 0–100%.
export function GrandMasterFader({
  playback,
  className,
}: {
  playback: PlaybackState;
  className?: string;
}) {
  return (
    <label className={cx(styles.grandMaster, className)}>
      <span className={styles.label}>
        Grand Master{' '}
        <Key>
          {SHORTCUTS.grandMasterDown} {SHORTCUTS.grandMasterUp}
        </Key>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={playback.grandMaster}
        onChange={(e) =>
          window.engine.send({ type: 'setGrandMaster', level: Number(e.target.value) })
        }
      />
      <output className={styles.percent}>{Math.round(playback.grandMaster * 100)}%</output>
    </label>
  );
}
