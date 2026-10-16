import type { CSSProperties } from 'react';
import type { FixtureLight } from '../../../shared/protocol';
import styles from './strobeBlink.module.css';

// The preview blinks no faster than this, in Hz.
const MAX_BLINK_HZ = 4;

// Blinks a strobing Fixture's light in the preview at its rate, at most
// `MAX_BLINK_HZ`. Nothing while it is steady.
export function strobeBlink({ strobe }: FixtureLight): {
  className?: string;
  style?: CSSProperties;
} {
  if (!strobe) return {};
  const period = 1 / Math.min(strobe, MAX_BLINK_HZ);
  return { className: styles.blink, style: { animationDuration: `${period}s` } };
}
