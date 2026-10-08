import type { ReactNode } from 'react';
import { ConfirmProvider } from './ConfirmDialog';
import { ToastProvider } from './Toast';
import { TooltipProvider } from './Tooltip';

// Tooltips, toasts and confirm dialogs for everything below it.
export function UiProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={400}>
      <ToastProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </ToastProvider>
    </TooltipProvider>
  );
}
