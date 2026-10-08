import { Redo2, Undo2 } from 'lucide-react';
import { IconButton } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import styles from './HistoryButtons.module.css';
import { HISTORY_SHORTCUTS, type HistoryCommand } from './shortcuts';
import type { HistoryCommands } from './useShortcuts';

const BUTTONS = [
  { command: 'undo', label: 'Undo', icon: <Undo2 /> },
  { command: 'redo', label: 'Redo', icon: <Redo2 /> },
] as const;

// A view's Undo and Redo buttons, each with its shortcut as a tooltip.
export function HistoryButtons({
  commands,
  enabled,
}: {
  commands: HistoryCommands;
  enabled: Record<HistoryCommand, boolean>;
}) {
  return (
    <span className={styles.buttons}>
      {BUTTONS.map(({ command, label, icon }) => (
        <Tooltip key={command} content={`${label} (${HISTORY_SHORTCUTS[command]})`}>
          <IconButton
            icon={icon}
            label={label}
            tooltip={false}
            disabled={!enabled[command]}
            onClick={commands[command]}
          />
        </Tooltip>
      ))}
    </span>
  );
}
