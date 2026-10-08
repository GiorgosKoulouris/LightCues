import type { SelectHTMLAttributes } from 'react';
import fieldStyles from './Field.module.css';
import styles from './Select.module.css';
import { cx } from './cx';
import { FieldFrame } from './fields';

export interface SelectOption<V extends string> {
  value: V;
  label: string;
  disabled?: boolean;
}

interface SelectProps<V extends string> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'onChange' | 'children'
> {
  label: string;
  hideLabel?: boolean;
  // Shown below, for a choice that was not taken.
  error?: string;
  value: V;
  options: readonly SelectOption<V>[];
  onChange: (value: V) => void;
}

// A native select: keyboard and screen reader support come for free.
export function Select<V extends string>({
  label,
  hideLabel,
  error,
  value,
  options,
  onChange,
  className,
  ...rest
}: SelectProps<V>) {
  return (
    <FieldFrame label={label} hideLabel={hideLabel} error={error} className={className}>
      {({ inputId, describedBy }) => (
        <select
          {...rest}
          id={inputId}
          aria-describedby={describedBy}
          aria-invalid={error !== undefined}
          className={cx(fieldStyles.input, styles.select)}
          value={value}
          onChange={(event) => onChange(event.target.value as V)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldFrame>
  );
}
