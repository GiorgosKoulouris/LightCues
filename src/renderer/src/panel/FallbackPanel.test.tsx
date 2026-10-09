import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
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
};

const PLAYBACK: PlaybackState = {
  active: { 'layer-1': 'blue' },
  mode: 'monitor',
  grandMaster: 0.8,
  blackout: false,
  freeze: false,
};

// The strip with its keys, as the app mounts them.
function Panel({ show, playback }: { show: Show; playback: PlaybackState }) {
  usePanelKeys(show, playback);
  return <FallbackPanel show={show} playback={playback} tempo={undefined} />;
}

function renderPanel(playback: PlaybackState = PLAYBACK) {
  render(
    <UiProvider>
      <Panel show={SHOW} playback={playback} />
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
