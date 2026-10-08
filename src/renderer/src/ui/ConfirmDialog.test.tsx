import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, useConfirm, type ConfirmOptions } from './ConfirmDialog';

function RemoveButton(props: {
  options?: Partial<ConfirmOptions>;
  onAnswer: (yes: boolean) => void;
}) {
  const confirm = useConfirm();
  return (
    <button
      type="button"
      onClick={async () =>
        props.onAnswer(
          await confirm({
            title: 'Remove Scene?',
            message: 'Verse is used by 2 Triggers.',
            confirmLabel: 'Remove',
            destructive: true,
            ...props.options,
          }),
        )
      }
    >
      Remove
    </button>
  );
}

function setup(options?: Partial<ConfirmOptions>) {
  const onAnswer = vi.fn();
  render(
    <ConfirmProvider>
      <RemoveButton options={options} onAnswer={onAnswer} />
    </ConfirmProvider>,
  );
  return onAnswer;
}

// Renders a provider and hands back its confirm function.
function renderAsker() {
  const handle: { confirm?: ReturnType<typeof useConfirm> } = {};
  function Asker() {
    const confirm = useConfirm();
    useEffect(() => {
      handle.confirm = confirm;
    });
    return null;
  }
  const { unmount } = render(
    <ConfirmProvider>
      <Asker />
    </ConfirmProvider>,
  );
  return { ask: (options: ConfirmOptions) => handle.confirm!(options), unmount };
}

const open = () => userEvent.click(screen.getByRole('button', { name: 'Remove' }));

describe('ConfirmDialog', () => {
  it('asks in a modal dialog with the title and message', async () => {
    setup();
    await open();
    const dialog = screen.getByRole('alertdialog', { name: 'Remove Scene?' });
    expect(dialog).toHaveAccessibleDescription('Verse is used by 2 Triggers.');
  });

  it('resolves true when confirmed', async () => {
    const onAnswer = setup();
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('resolves false on Cancel', async () => {
    const onAnswer = setup();
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
  });

  it('resolves false on Esc and returns focus to the button that asked', async () => {
    const onAnswer = setup();
    await open();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove' })).toHaveFocus());
  });

  it('focuses Cancel for a destructive action, so Enter does not destroy', async () => {
    const onAnswer = setup();
    await open();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
  });

  it('focuses the confirm button for a safe action', async () => {
    setup({ destructive: false, confirmLabel: 'Discard changes' });
    await open();
    expect(screen.getByRole('button', { name: 'Discard changes' })).toHaveFocus();
  });

  it('places focus again when a destructive question replaces a safe one', async () => {
    const { ask } = renderAsker();
    let first: Promise<boolean> = Promise.resolve(true);
    await act(async () => {
      first = ask({ title: 'Open Show?', confirmLabel: 'Open' });
    });
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
    await act(async () => {
      void ask({ title: 'Remove Scene?', confirmLabel: 'Remove', destructive: true });
    });
    expect(await first).toBe(false);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
  });

  it('answers no when the provider unmounts with a question open', async () => {
    const { ask, unmount } = renderAsker();
    let answer: Promise<boolean> = Promise.resolve(true);
    await act(async () => {
      answer = ask({ title: 'Remove Scene?', confirmLabel: 'Remove' });
    });
    unmount();
    expect(await answer).toBe(false);
  });

  it('throws when used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<RemoveButton onAnswer={() => {}} />)).toThrow(/ConfirmProvider/);
  });
});
