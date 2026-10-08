import * as RadixPopover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import { keepOpenOnLocalEscape } from './overlayEscape';
import styles from './Overlay.module.css';

interface PopoverProps {
  // A single element that takes a ref, such as a Button.
  trigger: ReactNode;
  // Names the popover for screen readers.
  label: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: RadixPopover.PopoverContentProps['side'];
  align?: RadixPopover.PopoverContentProps['align'];
  children: ReactNode;
}

export function Popover({
  trigger,
  label,
  open,
  onOpenChange,
  side = 'bottom',
  align = 'start',
  children,
}: PopoverProps) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          aria-label={label}
          side={side}
          align={align}
          sideOffset={6}
          className={styles.popover}
          onEscapeKeyDown={keepOpenOnLocalEscape}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
