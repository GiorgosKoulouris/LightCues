import { useCallback, useEffect } from 'react';
import type { DocumentKind } from '../../../shared/protocol';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import type { FileCommands } from './useShortcuts';

// A change resolves to the engine's errors, an empty list when done, or
// undefined when the user cancelled it.
export type Change = () => Promise<string[] | undefined>;

interface FileDocument {
  kind: DocumentKind;
  // The document as named in messages, such as "Show".
  name: string;
  // Undefined while loading.
  unsaved: boolean | undefined;
  newFile(): void;
  open: Change;
  save(options?: { as?: boolean }): Promise<string[] | undefined>;
  // After New or Open replaced the document.
  onReplaced?(): void;
}

// A view's file handling: guards the window close, asks before New or Open
// discard unsaved changes, and shows failures as error toasts and a save as a
// brief success toast. `run` runs any change the same way and resolves to
// whether it was done.
export function useFileCommands({
  kind,
  name,
  unsaved,
  newFile,
  open,
  save,
  onReplaced,
}: FileDocument) {
  const toast = useToast();
  const confirm = useConfirm();

  const showErrors = useCallback(
    (errors: string[]) => {
      if (errors.length > 0) toast({ tone: 'error', message: errorMessage(errors) });
    },
    [toast],
  );

  const run = useCallback(
    async (change: Change): Promise<boolean> => {
      let errors: string[] | undefined;
      try {
        errors = await change();
      } catch (error) {
        errors = [(error as Error).message];
      }
      if (errors === undefined) return false;
      showErrors(errors);
      return errors.length === 0;
    },
    [showErrors],
  );

  // Tells main whether closing the window would lose changes.
  useEffect(() => window.closeGuard.setUnsaved(kind, unsaved ?? false), [kind, unsaved]);

  // Save chosen when closing the window. Cancelling the file dialog keeps
  // the window open.
  useEffect(
    () =>
      window.closeGuard.onSaveBeforeClose(kind, async () => {
        const errors = await save().catch((error: Error) => [`Save failed: ${error.message}`]);
        if (errors) showErrors(errors);
        return errors?.length === 0;
      }),
    [kind, save, showErrors],
  );

  const discardUnsaved = async (): Promise<boolean> =>
    !unsaved ||
    confirm({
      title: 'Discard unsaved changes?',
      message: `The ${name} has unsaved changes.`,
      confirmLabel: 'Discard',
      destructive: true,
    });

  const saveAndTell = async (as: boolean) => {
    if (await run(() => save({ as }))) toast({ tone: 'success', message: `${name} saved` });
  };

  const fileCommands: FileCommands | undefined =
    unsaved === undefined
      ? undefined
      : {
          new: async () => {
            if (!(await discardUnsaved())) return;
            newFile();
            onReplaced?.();
          },
          open: async () => {
            if (!(await discardUnsaved())) return;
            if (await run(open)) onReplaced?.();
          },
          save: () => void saveAndTell(false),
          saveAs: () => void saveAndTell(true),
        };

  return { run, fileCommands };
}

function errorMessage(errors: string[]) {
  if (errors.length === 1) return errors[0];
  return (
    <ul>
      {errors.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}
