import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { IconButton } from './Button';
import styles from './Toast.module.css';
import { cx } from './cx';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastOptions {
  message: ReactNode;
  tone?: ToastTone;
}

interface ToastEntry extends Required<ToastOptions> {
  id: number;
}

// How long info and success toasts stay. Errors stay until dismissed.
const TOAST_MS = 3000;

const ToastContext = createContext<((toast: ToastOptions) => void) | null>(null);

// `toast({ tone, message })` shows a toast in the corner.
export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast needs a ToastProvider');
  return toast;
}

const ICONS = { info: Info, success: CircleCheck, error: CircleAlert };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setToasts((current) => [
      ...current,
      { id, message: options.message, tone: options.tone ?? 'info' },
    ]);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <section aria-label="Notifications" className={styles.region}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </section>
    </ToastContext.Provider>
  );
}

// onDismiss must be stable, or each render would restart the timer.
function ToastItem({ toast, onDismiss }: { toast: ToastEntry; onDismiss: (id: number) => void }) {
  const Icon = ICONS[toast.tone];

  useEffect(() => {
    if (toast.tone === 'error') return;
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast.id, toast.tone, onDismiss]);

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={cx(styles.toast, styles[toast.tone])}
    >
      <Icon className={styles.icon} aria-hidden />
      <div className={styles.message}>{toast.message}</div>
      <IconButton
        icon={<X />}
        label="Dismiss"
        tooltip={false}
        onClick={() => onDismiss(toast.id)}
      />
    </div>
  );
}
