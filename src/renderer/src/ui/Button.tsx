import type { ComponentProps, ReactNode } from 'react';
import styles from './Button.module.css';
import { cx } from './cx';
import { Tooltip } from './Tooltip';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  // `lg` is the large target for use during a gig.
  size?: 'md' | 'lg';
  // An icon before the label.
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], size === 'lg' && styles.lg, className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

interface IconButtonProps extends Omit<ButtonProps, 'icon' | 'children'> {
  icon: ReactNode;
  // The accessible name, also shown as a tooltip.
  label: string;
  // Off where focus lands on open, so the tooltip does not pop up.
  tooltip?: boolean;
}

export function IconButton({
  icon,
  label,
  tooltip = true,
  variant = 'ghost',
  className,
  ...rest
}: IconButtonProps) {
  const button = (
    <Button
      variant={variant}
      aria-label={label}
      className={cx(styles.iconOnly, className)}
      {...rest}
    >
      {icon}
    </Button>
  );
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
}
