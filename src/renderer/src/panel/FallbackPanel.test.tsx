import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { HouseFired } from '../../../shared/protocol';
import type { Scene, Show } from '../../../shared/show';
import type { PlaybackState } from '../show/usePlayback';
import { installFakeEngine, type FakeEngine } from '../test-engine';
import { UiProvider } from '../ui/UiProvider';
import { FallbackPanel } from './FallbackPanel';
import { usePanelKeys } from './usePanelKeys';

const scene = (id: string, name: string): Scene => ({
  id,
  name,
  tags: [],
  layer: 'layer-1',
  fadeIn: 0,
  rules: [],
});

const SHOW: Show = {
  layers: [{ id: 'layer-1', name: 'Base' }],
  scenes: [scene('warm', 'Warm'), scene('blue', 'Blue')],
  triggers: [],
  panelScenes: ['warm', 'blue'],
  housePresets: [
    { id: 'dim', name: 'Show dim', fade: 3 },
    { id: 'up', name: 'House up', fade: 2 },
  ],
};

const PLAYBACK: PlaybackState = {
  active: { 'layer-1': 'blue' },
  mode: 'monitor',
  grandMaster: 0.8,
  blackout: false,
  freeze: false,
};

// The strip with its keys, as the app mounts them.
function Panel({
  show,
  playback,
  house,
}: {
  show: Show;
  playback: PlaybackState;
  house?: HouseFired;
}) {
  usePanelKeys(show, playback);
  return <FallbackPanel show={show} playback={playback} tempo={undefined} house={house} />;
}

function renderPanel(playback: PlaybackState = PLAYBACK, house?: HouseFired, show = SHOW) {
  render(
    <UiProvider>
      <Panel show={show} playback={playback} house={house} />
    </UiProvider>,
  );
}

let engine: FakeEngine;

beforeEach(() => {
  engine = installFakeEngine();
});

describe('FallbackPanel Scene buttons', () => {
  it('goes to an inactive Scene, and clears the Layer of the active one', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Warm/ }));
    await userEvent.click(screen.getByRole('button', { name: /Blue/ }));
    expect(engine.sent).toEqual([
      { type: 'goScene', sceneId: 'warm' },
      { type: 'clearLayer', layerId: 'layer-1' },
    ]);
  });

  it('badges the active Scene while the Speed limit slows it, naming the length', () => {
    renderPanel({ ...PLAYBACK, limited: { 'layer-1': 2 } });
    const badge = screen.getByText('Limited');
    expect(screen.getByRole('button', { name: /Blue/ })).toContainElement(badge);
    expect(badge).toHaveAttribute('title', 'Speed limit: movement Effects run at 2 beats');
  });

  it('shows no Speed limit badge while no Layer is limited', () => {
    renderPanel();
    expect(screen.queryByText('Limited')).toBeNull();
  });

  it('toggles Scenes from their number keys', async () => {
    renderPanel();
    await userEvent.keyboard('12');
    expect(engine.sent).toEqual([
      { type: 'goScene', sceneId: 'warm' },
      { type: 'clearLayer', layerId: 'layer-1' },
    ]);
  });

  it('clears the Layer of the active Scene during Blackout', async () => {
    renderPanel({ ...PLAYBACK, blackout: true });
    await userEvent.keyboard('2');
    expect(engine.sent).toEqual([{ type: 'clearLayer', layerId: 'layer-1' }]);
  });
});

describe('FallbackPanel House Preset buttons', () => {
  const housePresets = () => screen.getByRole('group', { name: 'House Preset buttons' });

  it('shows each House Preset with its Shift key, the last fired pressed', () => {
    renderPanel(PLAYBACK, { type: 'preset', id: 'up' });

    const buttons = within(housePresets()).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Show dim ⇧1', 'House up ⇧2']);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });

  it('fires a House Preset from its button and from Shift with its number', async () => {
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: /House up/ }));
    await userEvent.keyboard('{Shift>}1{/Shift}');
    await userEvent.keyboard('{Shift>}3{/Shift}');

    expect(engine.sent).toEqual([
      { type: 'fireHousePreset', id: 'up' },
      { type: 'fireHousePreset', id: 'dim' },
    ]);
  });

  it('leaves them out with no House Presets', () => {
    renderPanel(PLAYBACK, undefined, { ...SHOW, housePresets: undefined });

    expect(screen.queryByRole('group', { name: 'House Preset buttons' })).toBeNull();
  });
});
