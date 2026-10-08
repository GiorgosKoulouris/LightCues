import { describe, expect, it } from 'vitest';
import type { Scene, Show } from '../../../shared/show';
import { layerGroups } from './perform';

const scene = (id: string, layer: string): Scene => ({
  id,
  name: id,
  tags: [],
  layer,
  fadeIn: 0,
  rules: [],
});

const SHOW: Show = {
  layers: [
    { id: 'base', name: 'Base' },
    { id: 'fx', name: 'Effects' },
    { id: 'spare', name: 'Spare' },
  ],
  scenes: [scene('strobe', 'fx'), scene('warm', 'base'), scene('cold', 'base')],
  triggers: [],
};

const summary = (show: Show) =>
  layerGroups(show).map((g) => [g.layer.id, g.scenes.map((s) => [s.scene.id, s.key])]);

describe('layerGroups', () => {
  it('groups every Scene by Layer, in Layer order then Show order, empty Layers included', () => {
    expect(summary(SHOW)).toEqual([
      [
        'base',
        [
          ['warm', undefined],
          ['cold', undefined],
        ],
      ],
      ['fx', [['strobe', undefined]]],
      ['spare', []],
    ]);
  });

  it("gives a Scene on the Fallback Panel its button's key", () => {
    const show = { ...SHOW, panelScenes: ['cold', 'strobe'] };
    expect(summary(show)).toEqual([
      [
        'base',
        [
          ['warm', undefined],
          ['cold', 1],
        ],
      ],
      ['fx', [['strobe', 2]]],
      ['spare', []],
    ]);
  });
});
