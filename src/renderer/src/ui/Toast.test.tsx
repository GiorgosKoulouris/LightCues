import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast, type ToastOptions } from './Toast';

function Notify({ toast: options }: { toast: ToastOptions }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast(options)}>
      Notify
    </button>
  );
}

const notify = (options: ToastOptions) => {
  render(
    <ToastProvider>
      <Notify toast={options} />
    </ToastProvider>,
  );
  act(() => screen.getByRole('button', { name: 'Notify' }).click());
};

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it('announces a success and hides it after a moment', () => {
    vi.useFakeTimers();
    notify({ tone: 'success', message: 'Show saved' });
    expect(screen.getByRole('status')).toHaveTextContent('Show saved');
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText('Show saved')).not.toBeInTheDocument();
  });

  it("does not restart a toast's timer when another one is shown", () => {
    vi.useFakeTimers();
    notify({ tone: 'success', message: 'Show saved' });
    act(() => vi.advanceTimersByTime(2000));
    act(() => screen.getByRole('button', { name: 'Notify' }).click());
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getAllByText('Show saved')).toHaveLength(1);
  });

  it('shows info when the tone is left undefined', () => {
    notify({ tone: undefined, message: 'Engine restarted' });
    expect(screen.getByRole('status')).toHaveTextContent('Engine restarted');
  });

  it('keeps an error as an alert until it is dismissed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    notify({ tone: 'error', message: 'Could not save: disk full' });
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save: disk full');
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps a toast with an action, then runs it and closes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onClick = vi.fn();
    notify({ message: 'Imported 3 Profiles', action: { label: 'Show in folder', onClick } });
    act(() => vi.advanceTimersByTime(60_000));
    await userEvent.click(screen.getByRole('button', { name: 'Show in folder' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Imported 3 Profiles')).not.toBeInTheDocument();
  });

  it('throws when used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Notify toast={{ message: 'x' }} />)).toThrow(/ToastProvider/);
  });
});
