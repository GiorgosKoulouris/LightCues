import type { PlaybackMode } from '../../../shared/protocol';
import { cx } from '../ui/cx';
import styles from './ModeSwitch.module.css';

const MODES: Record<PlaybackMode, { label: string; hint: string }> = {
  monitor: { label: 'Monitor', hint: 'Changes are sent to the rig.' },
  blind: {
    label: 'Blind',
    hint: 'The rig holds its last look; changes are not sent, except Blackout.',
  },
};

// Monitor or Blind. In Blind the Preview shows what would be sent.
export function ModeSwitch({ mode }: { mode: PlaybackMode }) {
  return (
    <div role="group" aria-label="Mode" title={MODES[mode].hint} className={styles.switch}>
      {(Object.keys(MODES) as PlaybackMode[]).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          className={cx(styles.option, mode === m && styles[m])}
          onClick={() => window.engine.send({ type: 'setMode', mode: m })}
        >
          {MODES[m].label}
        </button>
      ))}
    </div>
  );
}
