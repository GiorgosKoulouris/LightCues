import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  // Red confirm button, and focus starts on Cancel.
  destructive?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

// Replaces `window.confirm`: `await confirm({...})` is true when confirmed.
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm needs a ConfirmProvider');
  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  // Each question gets its own key, so focus is placed again for a new one.
  const [question, setQuestion] = useState<{ id: number; options: ConfirmOptions } | null>(null);
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<((yes: boolean) => void) | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // There is no Radix trigger, so focus is returned by hand.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const answer = useCallback((yes: boolean) => {
    resolveRef.current?.(yes);
    resolveRef.current = null;
    setOpen(false);
  }, []);

  const confirm = useCallback<Confirm>((next) => {
    // A new question answers an open one with no, and keeps its focus target.
    if (resolveRef.current) resolveRef.current(false);
    else if (document.activeElement instanceof HTMLElement) {
      returnFocusRef.current = document.activeElement;
    }
    setQuestion((current) => ({ id: (current?.id ?? 0) + 1, options: next }));
    setOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  // An unanswered question is a no when the provider goes away.
  useEffect(() => () => resolveRef.current?.(false), []);

  const options = question?.options;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {question && options && (
        <Dialog
          key={question.id}
          open={open}
          onOpenChange={(next) => {
            if (!next) answer(false);
          }}
          role="alertdialog"
          title={options.title}
          description={options.message}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (options.destructive ? cancelRef : confirmRef).current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }}
          footer={
            <>
              <Button ref={cancelRef} onClick={() => answer(false)}>
                {options.cancelLabel ?? 'Cancel'}
              </Button>
              <Button
                ref={confirmRef}
                variant={options.destructive ? 'danger' : 'primary'}
                onClick={() => answer(true)}
              >
                {options.confirmLabel}
              </Button>
            </>
          }
        />
      )}
    </ConfirmContext.Provider>
  );
}
