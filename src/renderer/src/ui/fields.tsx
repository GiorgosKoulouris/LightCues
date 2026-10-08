import { Search } from 'lucide-react';
import {
  useId,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import styles from './Field.module.css';
import { cx } from './cx';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

type InputAttributes = Omit<
  ComponentProps<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'children'
>;

interface InlineEditOptions<T> {
  value: T;
  format: (value: T) => string;
  parse: (text: string) => ParseResult<T>;
  onCommit: (value: T) => void;
  equals?: (a: T, b: T) => boolean;
}

interface Edit<T> {
  text: string;
  // The committed value the text was typed against.
  base: T;
  // Values committed during this edit whose echo may still be on its way.
  sent: T[];
}

// Inline validation (ADR 0004): every valid edit commits at once, an invalid
// one shows its error and is not committed, and Esc reverts to the committed
// value. A new value from outside, like an undo, replaces the text, unless it
// is the text's own value or the late echo of an earlier keystroke.
export function useInlineEdit<T>({
  value,
  format,
  parse,
  onCommit,
  equals = Object.is,
}: InlineEditOptions<T>) {
  const [edit, setEdit] = useState<Edit<T> | null>(null);

  let current = edit;
  if (edit && !equals(edit.base, value)) {
    const result = parse(edit.text);
    const ours =
      (result.ok && equals(result.value, value)) || edit.sent.some((sent) => equals(sent, value));
    current = ours ? { ...edit, base: value } : null;
    setEdit(current);
  }

  const result = current ? parse(current.text) : undefined;

  const change = (text: string) => {
    const next = parse(text);
    const commit = next.ok && !equals(next.value, value);
    setEdit({
      text,
      base: value,
      sent: commit ? [...(current?.sent ?? []), next.value] : (current?.sent ?? []),
    });
    if (commit) onCommit(next.value);
  };

  return {
    text: current ? current.text : format(value),
    error: result && !result.ok ? result.error : undefined,
    // The value the text means now, or undefined while it is invalid.
    parsed: result ? (result.ok ? result.value : undefined) : value,
    change,
    revert: () => setEdit(null),
    // Shows a valid edit in its canonical form; an invalid one stays.
    settle: () => {
      if (!result || result.ok) setEdit(null);
    },
  };
}

export type InlineEdit<T> = ReturnType<typeof useInlineEdit<T>>;

interface FieldFrameProps {
  label: string;
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: (ids: { inputId: string; describedBy: string | undefined }) => ReactNode;
}

// A label above the control and a hint or error below it.
export function FieldFrame({
  label,
  hideLabel,
  hint,
  error,
  className,
  children,
}: FieldFrameProps) {
  const inputId = useId();
  const messageId = useId();
  const message = error ?? hint;
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={inputId} className={hideLabel ? 'visually-hidden' : styles.label}>
        {label}
      </label>
      {children({ inputId, describedBy: message ? messageId : undefined })}
      {message && (
        <span id={messageId} className={error ? styles.error : styles.hint}>
          {message}
        </span>
      )}
    </div>
  );
}

interface LabelProps {
  label: string;
  hideLabel?: boolean;
  hint?: ReactNode;
}

interface InlineInputProps<T> extends InputAttributes, LabelProps {
  edit: InlineEdit<T>;
  mono?: boolean;
}

// A text input for an inline edit, with its label and error. For a draft
// value that must be valid before an action, such as a dialog's Add.
export function InlineInput<T>({
  edit,
  label,
  hideLabel,
  hint,
  mono,
  className,
  onKeyDown,
  onBlur,
  ...rest
}: InlineInputProps<T>) {
  return (
    <FieldFrame label={label} hideLabel={hideLabel} hint={hint} error={edit.error}>
      {({ inputId, describedBy }) => (
        <input
          {...rest}
          id={inputId}
          type="text"
          className={cx(styles.input, mono && styles.mono, className)}
          value={edit.text}
          aria-invalid={edit.error !== undefined}
          aria-describedby={describedBy}
          onChange={(event) => edit.change(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && edit.error !== undefined) {
              // Esc that reverts does only that, e.g. it does not close a drawer.
              event.preventDefault();
              edit.revert();
            }
            onKeyDown?.(event);
          }}
          onBlur={(event) => {
            edit.settle();
            onBlur?.(event);
          }}
        />
      )}
    </FieldFrame>
  );
}

interface TextFieldProps<T>
  extends InputAttributes, LabelProps, Omit<InlineEditOptions<T>, 'format'> {
  mono?: boolean;
  format?: (value: T) => string;
}

export function TextField<T>({
  value,
  format = String,
  parse,
  onCommit,
  equals,
  ...rest
}: TextFieldProps<T>) {
  const edit = useInlineEdit({ value, format, parse, onCommit, equals });
  return <InlineInput edit={edit} {...rest} />;
}

export interface NumberRange {
  min?: number;
  max?: number;
  // Whole numbers only (the default).
  integer?: boolean;
}

// A trimmed text that must not be empty; `label` names it in the error.
export function parseRequired(label: string) {
  return (text: string): ParseResult<string> => {
    const value = text.trim();
    return value === '' ? { ok: false, error: `${label} is required` } : { ok: true, value };
  };
}

// A name, trimmed; it must not be empty.
export const parseName = parseRequired('Name');

export function parseNumber(text: string, range: NumberRange = {}): ParseResult<number> {
  const { min = -Infinity, max = Infinity, integer = true } = range;
  const trimmed = text.trim();
  const value = Number(trimmed);
  if (trimmed === '' || !Number.isFinite(value)) return { ok: false, error: 'Must be a number' };
  if (integer && !Number.isInteger(value)) return { ok: false, error: 'Must be a whole number' };
  if (value < min || value > max) {
    const error =
      min === -Infinity
        ? `Must be at most ${max}`
        : max === Infinity
          ? `Must be at least ${min}`
          : `Must be ${min}–${max}`;
    return { ok: false, error };
  }
  return { ok: true, value };
}

interface NumberFieldProps
  extends Omit<InputAttributes, 'min' | 'max' | 'step'>, LabelProps, NumberRange {
  value: number;
  // Arrow Up/Down step.
  step?: number;
  onCommit: (value: number) => void;
}

// A number in a monospace field. Arrow keys step it within range.
export function NumberField({
  value,
  min,
  max,
  integer,
  step = 1,
  onCommit,
  onKeyDown,
  ...rest
}: NumberFieldProps) {
  const edit = useInlineEdit({
    value,
    format: String,
    parse: (text) => parseNumber(text, { min, max, integer }),
    onCommit,
  });

  const stepBy = (event: KeyboardEvent, direction: 1 | -1) => {
    if (edit.parsed === undefined) return;
    event.preventDefault();
    const next = edit.parsed + direction * step;
    edit.change(String(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, next))));
  };

  return (
    <InlineInput
      edit={edit}
      mono
      inputMode={integer === false ? 'decimal' : 'numeric'}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') stepBy(event, 1);
        if (event.key === 'ArrowDown') stepBy(event, -1);
        onKeyDown?.(event);
      }}
      {...rest}
    />
  );
}

interface SearchFieldProps extends Omit<InputAttributes, 'aria-label'> {
  // The accessible name.
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}

// A search box with an icon. Esc clears it.
export function SearchField({
  label,
  value,
  onChange,
  inputRef,
  className,
  onKeyDown,
  ...rest
}: SearchFieldProps) {
  return (
    <div className={cx(styles.search, className)}>
      <Search className={styles.searchIcon} aria-hidden />
      <input
        {...rest}
        ref={inputRef}
        type="search"
        aria-label={label}
        className={cx(styles.input, styles.searchInput)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value !== '') {
            event.preventDefault();
            onChange('');
          }
          onKeyDown?.(event);
        }}
      />
    </div>
  );
}
