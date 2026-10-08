import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';
import { NumberField, parseRequired, TextField } from './fields';

const nonEmpty = (text: string) =>
  text.trim() === ''
    ? { ok: false as const, error: 'Name is required' }
    : { ok: true as const, value: text.trim() };

function Controlled(props: { initial: string; onCommit?: (value: string) => void }) {
  const [value, setValue] = useState(props.initial);
  return (
    <TextField
      label="Name"
      value={value}
      parse={nonEmpty}
      onCommit={(next) => {
        props.onCommit?.(next);
        setValue(next);
      }}
    />
  );
}

describe('TextField', () => {
  it('commits each valid edit as it is typed', async () => {
    const onCommit = vi.fn();
    render(<Controlled initial="Wash" onCommit={onCommit} />);
    const field = screen.getByLabelText('Name');
    await userEvent.type(field, 'es');
    expect(onCommit).toHaveBeenLastCalledWith('Washes');
    expect(field).toHaveValue('Washes');
    expect(field).toHaveAttribute('aria-invalid', 'false');
  });

  it('shows an inline error and does not commit an invalid edit', async () => {
    const onCommit = vi.fn();
    render(<Controlled initial="W" onCommit={onCommit} />);
    const field = screen.getByLabelText('Name');
    await userEvent.type(field, '{Backspace}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(field).toHaveValue('');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Name is required');
  });

  it('reverts an invalid edit to the committed value on Esc', async () => {
    render(<Controlled initial="Spots" />);
    const field = screen.getByLabelText('Name');
    await userEvent.clear(field);
    await userEvent.type(field, '{Escape}');
    expect(field).toHaveValue('Spots');
    expect(field).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
  });

  it('keeps the error after leaving an invalid field', async () => {
    render(<Controlled initial="Spots" />);
    const field = screen.getByLabelText('Name');
    await userEvent.clear(field);
    await userEvent.tab();
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a new value from outside, like an undo, even mid-edit', async () => {
    const { rerender } = render(
      <TextField label="Name" value="Front" parse={nonEmpty} onCommit={() => {}} />,
    );
    const field = screen.getByLabelText('Name');
    await userEvent.type(field, '{Backspace}');
    rerender(<TextField label="Name" value="Back" parse={nonEmpty} onCommit={() => {}} />);
    expect(field).toHaveValue('Back');
  });

  it('keeps the typed text when the committed value arrives, so 1. is not cut to 1', async () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <NumberField label="Level" integer={false} value={1} onCommit={onCommit} />,
    );
    const field = screen.getByLabelText('Level');
    await userEvent.type(field, '.5');
    expect(onCommit).toHaveBeenLastCalledWith(1.5);
    rerender(<NumberField label="Level" integer={false} value={1.5} onCommit={onCommit} />);
    expect(field).toHaveValue('1.5');
    await userEvent.type(field, '0');
    rerender(<NumberField label="Level" integer={false} value={1.5} onCommit={onCommit} />);
    expect(field).toHaveValue('1.50');
  });

  it('does not commit when the edit parses to the committed value', async () => {
    const onCommit = vi.fn();
    render(<Controlled initial="Wash" onCommit={onCommit} />);
    await userEvent.type(screen.getByLabelText('Name'), ' ');
    expect(onCommit).not.toHaveBeenCalled();
  });
});

function Address(props: { onCommit?: (value: number) => void }) {
  const [value, setValue] = useState(1);
  return (
    <NumberField
      label="Address"
      value={value}
      min={1}
      max={512}
      onCommit={(next) => {
        props.onCommit?.(next);
        setValue(next);
      }}
    />
  );
}

describe('NumberField', () => {
  it('commits whole numbers in range', async () => {
    const onCommit = vi.fn();
    render(<Address onCommit={onCommit} />);
    const field = screen.getByLabelText('Address');
    await userEvent.type(field, '2');
    expect(onCommit).toHaveBeenLastCalledWith(12);
  });

  it('rejects numbers out of range, decimals and text, and reverts on Esc', async () => {
    const onCommit = vi.fn();
    render(<Address onCommit={onCommit} />);
    const field = screen.getByLabelText('Address');
    await userEvent.clear(field);
    await userEvent.type(field, '513');
    expect(field).toHaveAccessibleDescription('Must be 1–512');
    await userEvent.clear(field);
    await userEvent.type(field, '1.5');
    expect(field).toHaveAccessibleDescription('Must be a whole number');
    await userEvent.clear(field);
    await userEvent.type(field, 'x');
    expect(field).toHaveAccessibleDescription('Must be a number');
    expect(onCommit).not.toHaveBeenCalledWith(513);
    await userEvent.type(field, '{Escape}');
    expect(field).toHaveValue('1');
  });

  it('steps with the arrow keys within range', async () => {
    const onCommit = vi.fn();
    render(<Address onCommit={onCommit} />);
    const field = screen.getByLabelText('Address');
    await userEvent.type(field, '{ArrowUp}{ArrowUp}');
    expect(onCommit).toHaveBeenLastCalledWith(3);
    await userEvent.type(field, '{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(field).toHaveValue('1');
  });
});

describe('inline editing', () => {
  it('keeps typing when the engine echoes an earlier keystroke late', async () => {
    const engine: { echo?: (value: number) => void } = {};
    const commits: number[] = [];
    function Engine() {
      const [value, setValue] = useState(1);
      useEffect(() => {
        engine.echo = setValue;
      }, []);
      return (
        <NumberField
          label="Address"
          value={value}
          min={1}
          max={512}
          onCommit={(next) => commits.push(next)}
        />
      );
    }
    render(<Engine />);
    const field = screen.getByLabelText('Address');
    await userEvent.type(field, '23');
    expect(commits).toEqual([12, 123]);
    act(() => engine.echo!(12));
    expect(field).toHaveValue('123');
    act(() => engine.echo!(123));
    expect(field).toHaveValue('123');
    act(() => engine.echo!(7));
    expect(field).toHaveValue('7');
  });

  it('takes an equals for values that are not primitives', async () => {
    type Pair = { a: string };
    function Pairs() {
      const [value, setValue] = useState<Pair>({ a: 'x' });
      return (
        <TextField
          label="Pair"
          value={value}
          format={(pair) => pair.a}
          parse={(text) => ({ ok: true, value: { a: text.trim() } })}
          equals={(left, right) => left.a === right.a}
          onCommit={setValue}
        />
      );
    }
    render(<Pairs />);
    const field = screen.getByLabelText('Pair');
    await userEvent.type(field, ' y');
    expect(field).toHaveValue('x y');
  });

  it('Esc on an invalid field in a dialog reverts the field and keeps the dialog open', async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange} title="Add Fixture">
        <Controlled initial="Spot 1" />
      </Dialog>,
    );
    const field = screen.getByLabelText('Name');
    await userEvent.clear(field);
    await userEvent.keyboard('{Escape}');
    expect(field).toHaveValue('Spot 1');
    expect(onOpenChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('parseRequired', () => {
  it('trims the text and names the field in its error', () => {
    const parse = parseRequired('Model');
    expect(parse('  Par ')).toEqual({ ok: true, value: 'Par' });
    expect(parse(' ')).toEqual({ ok: false, error: 'Model is required' });
  });
});
