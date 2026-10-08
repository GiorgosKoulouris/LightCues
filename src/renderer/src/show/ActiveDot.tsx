import styles from './ActiveDot.module.css';

// Marks an active Scene wherever it is listed. Takes its space when off, so
// names line up.
export function ActiveDot({ on }: { on: boolean }) {
  return on ? (
    <span role="img" aria-label="active" className={styles.dot} />
  ) : (
    <span aria-hidden className={styles.off} />
  );
}
