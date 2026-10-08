import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from './Button';
import { keepOpenOnLocalEscape } from './overlayEscape';
import styles from './Overlay.module.css';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  // Buttons, right-aligned below the content.
  footer?: ReactNode;
  // `alertdialog` for a question that must be answered.
  role?: 'dialog' | 'alertdialog';
  // Where focus goes on open; the first focusable element by default.
  onOpenAutoFocus?: (event: Event) => void;
  // Where focus goes on close; the Radix trigger by default.
  onCloseAutoFocus?: (event: Event) => void;
  children?: ReactNode;
}

// A modal dialog. Esc and a click outside close it.
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  role = 'dialog',
  onOpenAutoFocus,
  onCloseAutoFocus,
  children,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.backdrop} />
        <RadixDialog.Content
          role={role}
          // Marks it modal, so app shortcuts such as Undo leave it alone.
          aria-modal
          className={styles.dialog}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          onEscapeKeyDown={keepOpenOnLocalEscape}
          // Without a description Radix expects this to be set explicitly.
          {...(description === undefined && { 'aria-describedby': undefined })}
        >
          <header className={styles.dialogHeader}>
            <RadixDialog.Title className={styles.dialogTitle}>{title}</RadixDialog.Title>
            {role === 'dialog' && (
              <RadixDialog.Close asChild>
                <IconButton icon={<X />} label="Close" tooltip={false} />
              </RadixDialog.Close>
            )}
          </header>
          {description !== undefined && (
            <RadixDialog.Description className={styles.dialogDescription}>
              {description}
            </RadixDialog.Description>
          )}
          {children}
          {footer && <footer className={styles.dialogFooter}>{footer}</footer>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
