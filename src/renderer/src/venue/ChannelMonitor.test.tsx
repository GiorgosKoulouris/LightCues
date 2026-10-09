import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FixtureProfile } from '../../../shared/fixture-profile';
import type { OutputStatus } from '../../../shared/protocol';
import type { VenuePatch } from '../../../shared/venue-patch';
import { installFakeEngine, type FakeEngine } from '../test-engine';
import { ChannelMonitor } from './ChannelMonitor';

const par: FixtureProfile = {
  id: 'acme/par',
  manufacturer: 'Acme',
  model: 'Par',
  defaultRole: 'Wash',
  modes: [
    {
      name: '3ch',
      channels: [
        { kind: 'control', name: 'Dimmer', defaultValue: 0, ranges: [] },
        { kind: 'control', name: 'Pan', defaultValue: 0, ranges: [] },
        { kind: 'fine', name: 'Pan fine', of: 'Pan', byte: 1, defaultValue: 0 },
      ],
    },
  ],
};

// Par 1 at 10–12 in Universe 1; Universe 2 is not mapped.
const PATCH: VenuePatch = {
  stage: { width: 12, depth: 9 },
  universes: [{ number: 1, output: 'virtual' }, { number: 2 }],
  profiles: [par],
  fixtures: [
    {
      ...{ id: 'par-1', name: 'Par 1', profileId: 'acme/par', mode: '3ch' },
      ...{ universe: 1, address: 10, x: 0, y: 1, height: 0 },
    },
  ],
};

const SENDING: OutputStatus[] = [{ id: 'virtual', name: 'Virtual Output', state: 'sending' }];

let engine: FakeEngine;

beforeEach(() => {
  engine = installFakeEngine();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const cells = () => within(screen.getByRole('grid')).getAllByRole('gridcell');
const readout = () => screen.getByTestId('channel-readout');

describe('ChannelMonitor', () => {
  it('monitors the first Universe and stops when closed', () => {
    const { unmount } = render(<ChannelMonitor patch={PATCH} outputs={SENDING} />);
    expect(engine.sent).toEqual([{ type: 'monitorUniverse', universe: 1 }]);

    unmount();
    expect(engine.sent.at(-1)).toEqual({ type: 'stopMonitor' });
  });

  it('shows the 512 values of the monitored Universe, zeros dimmed', () => {
    render(<ChannelMonitor patch={PATCH} outputs={SENDING} />);
    const values = Array.from({ length: 512 }, (_, i) => (i === 9 ? 255 : 0));
    engine.emit({ type: 'dmxFrame', universe: 1, values });

    expect(cells()).toHaveLength(512);
    expect(within(screen.getByRole('grid')).getAllByRole('row')).toHaveLength(16);
    expect(cells()[9]).toHaveTextContent('255');
    expect(cells()[9]).not.toHaveAttribute('data-zero');
    expect(cells()[0]).toHaveTextContent('0');
    expect(cells()[0]).toHaveAttribute('data-zero');
  });

  it('ignores frames of another Universe', () => {
    render(<ChannelMonitor patch={PATCH} outputs={SENDING} />);
    engine.emit({ type: 'dmxFrame', universe: 2, values: new Array<number>(512).fill(7) });

    expect(cells()[0]).toHaveTextContent('0');
  });

  it('shows the channel, its Fixture and the channel name on hover', () => {
    render(<ChannelMonitor patch={PATCH} outputs={SENDING} />);

    fireEvent.mouseEnter(cells()[10]!);
    expect(readout()).toHaveTextContent('Channel 11 · Par 1 · Pan');
    fireEvent.mouseEnter(cells()[11]!);
    expect(readout()).toHaveTextContent('Channel 12 · Par 1 · Pan fine');
    fireEvent.mouseEnter(cells()[12]!);
    expect(readout()).toHaveTextContent('Channel 13 · No Fixture');
  });

  it('switches Universe and says when nothing is sent for it', async () => {
    render(<ChannelMonitor patch={PATCH} outputs={SENDING} />);
    expect(screen.queryByText(/nothing is sent/)).toBeNull();

    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Universe' }), '2');

    expect(engine.sent.at(-1)).toEqual({ type: 'monitorUniverse', universe: 2 });
    expect(screen.getByText('Universe 2 has no Output: nothing is sent.')).toBeInTheDocument();
  });

  it('says when the Output is not sending', () => {
    const missing: OutputStatus[] = [{ id: 'virtual', name: 'Virtual Output', state: 'unused' }];
    render(<ChannelMonitor patch={PATCH} outputs={missing} />);

    expect(screen.getByText('Virtual Output is not sending: nothing is sent.')).toBeInTheDocument();
  });
});
