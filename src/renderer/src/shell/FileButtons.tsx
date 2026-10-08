import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import styles from './FileButtons.module.css';
import { fileShortcut, type FileCommand } from './shortcuts';
import type { FileCommands } from './useShortcuts';

const LABELS: Record<FileCommand, string> = {
  new: 'New',
  open: 'Open…',
  save: 'Save',
  saveAs: 'Save As…',
};

// A view's New, Open, Save and Save As buttons, each with its shortcut as a
// tooltip.
export function FileButtons({ commands }: { commands: FileCommands }) {
  return (
    <span className={styles.buttons}>
      {(Object.keys(LABELS) as FileCommand[]).map((command) => (
        <Tooltip key={command} content={fileShortcut(command)}>
          <Button onClick={commands[command]}>{LABELS[command]}</Button>
        </Tooltip>
      ))}
    </span>
  );
}
