import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Scene, Show } from '../../../shared/show';
import { emptyPatch } from '../../../shared/venue-patch';
import type { TempoState } from '../panel/useTempo';
import type { PlaybackState } from '../show/usePlayback';
import { installFakeEngine, type FakeEngine } from '../test-engine';
import { UiProvider } from '../ui/UiProvider';
import { PerformView } from './PerformView';

const scene = (id: string, name: string, layer: string): Scene => ({
  id,
  name,
  tags: [],
  layer,
  fadeIn: 0,
  rules: [],
});

const SHOW: Show = {
  layers: [
    { id: 'layer-1', name: 'Base' },
    { id: 'layer-2', name: 'Accents' },
  ],
  scenes: [
    scene('warm', 'Warm', 'layer-1'),
    scene('hit', 'Strobe hit', 'layer-2'),
    scene('blue', 'Blue', 'layer-1'),
  ],
  triggers: [],
  baseLook: 'warm',
  panelScenes: ['blue'],
};

const PLAYBACK: PlaybackState = {
  active: { 'layer-1': 'blue' },
  mode: 'monitor',
  grandMaster: 0.8,
  blackout: false,
  freeze: false,
};

let engine: FakeEngine;

const TEMPO: TempoState = { bpm: 128, source: 'clock' };

function renderView(show: Show = SHOW, playback: PlaybackState = PLAYBACK, active = true) {
  render(
    <UiProvider>
      <PerformView
        active={active}
        show={show}
        patch={emptyPatch({ width: 10, depth: 6 })}
        playback={playback}
        tempo={TEMPO}
      />
    </UiProvider>,
  );
}

const layer = (name: string) => screen.getByRole('region', { name });
const buttonNames = (region: HTMLElement) =>
  within(region)
    .getAllByRole('button')
    .map((b) => b.textContent);

beforeEach(() => {
  engine = installFakeEngine();
});

describe('PerformView', () => {
  it('shows every Scene grouped by Layer, the active one pressed, with its panel key', () => {
    renderView();
    expect(buttonNames(layer('Base'))).toEqual(['Clear', 'Warm', 'Blue1']);
    expect(buttonNames(layer('Accents'))).toEqual(['Clear', 'Strobe hit']);
    expect(within(layer('Base')).getByRole('button', { name: /Blue/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(layer('Base')).getByRole('button', { name: 'Warm' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('goes to a Scene and clears a Layer with an active Scene', async () => {
    renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Strobe hit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear Base' }));
    expect(screen.getByRole('button', { name: 'Clear Accents' })).toBeDisabled();
    expect(engine.sent).toEqual([
      { type: 'startPreview' },
      { type: 'goScene', sceneId: 'hit' },
      { type: 'clearLayer', layerId: 'layer-1' },
    ]);
  });

  it('toggles a Scene button: goes to an inactive Scene, clears the Layer of the active one', async () => {
    renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Warm' }));
    await userEvent.click(screen.getByRole('button', { name: /Blue/ }));
    expect(engine.sent).toEqual([
      { type: 'startPreview' },
      { type: 'goScene', sceneId: 'warm' },
      { type: 'clearLayer', layerId: 'layer-1' },
    ]);
  });

  it('runs Blackout, the Base Look and the Grand Master', async () => {
    renderView();
    await userEvent.click(screen.getByRole('button', { name: /Blackout/ }));
    await userEvent.click(screen.getByRole('button', { name: /Base Look: Warm/ }));
    expect(screen.getByRole('slider', { name: /Grand Master/ })).toHaveValue('0.8');
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(engine.sent.slice(1)).toEqual([
      { type: 'setBlackout', on: true },
      { type: 'goBaseLook' },
    ]);
  });

  it('taps the Tempo and shows it', async () => {
    renderView();
    const tap = screen.getByRole('button', { name: /Tap/ });
    expect(tap).toHaveTextContent('128 BPM');
    await userEvent.click(tap);
    expect(engine.sent.at(-1)).toEqual({ type: 'tapTempo' });
  });

  it('turns Freeze on', async () => {
    renderView();
    const freeze = screen.getByRole('button', { name: /Freeze/ });
    expect(freeze).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(freeze);
    expect(engine.sent.at(-1)).toEqual({ type: 'setFreeze', on: true });
  });

  it('turns Freeze off when on', async () => {
    renderView(SHOW, { ...PLAYBACK, freeze: true });
    const freeze = screen.getByRole('button', { name: /Freeze/ });
    expect(freeze).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(freeze);
    expect(engine.sent.at(-1)).toEqual({ type: 'setFreeze', on: false });
  });

  it('shows Blackout as on', () => {
    renderView(SHOW, { ...PLAYBACK, blackout: true });
    expect(screen.getByRole('button', { name: /Blackout/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows the Preview and nothing to edit', () => {
    renderView();
    expect(screen.getByRole('img', { name: 'Top-down preview' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('switches between Monitor and Blind', async () => {
    renderView();
    const mode = screen.getByRole('group', { name: 'Mode' });
    expect(within(mode).getByRole('button', { name: 'Monitor' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(within(mode).getByRole('button', { name: 'Blind' }));
    expect(engine.sent.at(-1)).toEqual({ type: 'setMode', mode: 'blind' });
  });

  it('mounts the Preview only while shown', () => {
    renderView(SHOW, PLAYBACK, false);
    expect(screen.queryByRole('img', { name: 'Top-down preview' })).toBeNull();
    expect(engine.sent).toEqual([]);
  });

  it('marks the active Scene with the active dot', () => {
    renderView();
    const base = layer('Base');
    expect(within(base).getAllByRole('img', { name: 'active' })).toHaveLength(1);
    expect(within(base).getByRole('button', { name: /Blue/ })).toContainElement(
      within(base).getByRole('img', { name: 'active' }),
    );
  });

  it('says where to add Scenes when the Show has none', () => {
    renderView({ ...SHOW, scenes: [], baseLook: undefined, panelScenes: undefined });
    expect(screen.getByText('No Scenes: add them in the Show view.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Base' })).toBeNull();
  });
});
