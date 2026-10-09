import { Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import styles from './ExampleHint.module.css';

// Shown while nothing is open, so a new user can try a Show without a rig.
export function ExampleHint({ onOpen }: { onOpen: () => void }) {
  return (
    <aside aria-label="Example" className={styles.hint}>
      <Sparkles className={styles.icon} aria-hidden />
      <span className={styles.message}>
        <strong>New here?</strong> Open the example: a small rig and a Show that run with no
        hardware.
      </span>
      <Button variant="primary" onClick={onOpen}>
        Open example
      </Button>
    </aside>
  );
}
