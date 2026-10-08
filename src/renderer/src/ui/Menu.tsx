import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import styles from './Overlay.module.css';
import { cx } from './cx';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  // A single element that takes a ref, such as an IconButton.
  trigger: ReactNode;
  items: readonly MenuItem[];
  align?: RadixMenu.DropdownMenuContentProps['align'];
}

export function Menu({ trigger, items, align = 'end' }: MenuProps) {
  return (
    <RadixMenu.Root>
      <RadixMenu.Trigger asChild>{trigger}</RadixMenu.Trigger>
      <RadixMenu.Portal>
        <RadixMenu.Content align={align} sideOffset={6} className={styles.menu}>
          {items.map((item) => (
            <RadixMenu.Item
              key={item.label}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={cx(styles.menuItem, item.danger && styles.menuDanger)}
            >
              {item.icon}
              {item.label}
            </RadixMenu.Item>
          ))}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
}
