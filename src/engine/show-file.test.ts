import { describe, expect, it } from 'vitest';
import type { Show } from '../shared/show';
import { loadShowFile, saveShowFile } from './show-file';

// Uses every part of the model, optional ones included.
const show: Show = {
  layers: [
    { id: 'base', name: 'Base' },
    { id: 'accents', name: 'Accents' },
  ],
  scenes: [
    {
      id: 'verse',
      name: 'Verse',
      tags: ['song A', 'calm'],
      layer: 'base',
      fadeIn: 2.5,
      rules: [
        { target: {}, intensity: 0.6, colour: { swatch: 'Warm White' } },
        {
          target: {
            zones: [{ row: 'Upstage', column: 'Centre', level: 'Overhead' }],
            roles: ['Wash', 'Pixel/Bar'],
          },
          colour: { hue: 240, saturation: 0.8 },
        },
      ],
    },
    {
      id: 'hit',
      name: 'Hit',
      tags: [],
      layer: 'accents',
      fadeIn: 0,
      rules: [{ target: { roles: ['Blinder'] }, intensity: 1 }],
    },
  ],
  triggers: [
    { channel: 1, note: 60, scene: 'verse', mode: 'go' },
    { channel: 1, note: 61, scene: 'hit', mode: 'flash' },
    { channel: 16, note: 0, scene: 'hit', mode: 'release' },
  ],
  baseLook: 'verse',
  defaultColour: { hue: 30, saturation: 0.2 },
  panelScenes: ['hit', 'verse'],
};

describe('.lcshow file', () => {
  it('round-trips a Show losslessly', () => {
    expect(loadShowFile(saveShowFile(show))).toEqual(show);
  });

  it('rejects a file of an unknown version', () => {
    const saved = JSON.parse(saveShowFile(show));

    expect(() => loadShowFile(JSON.stringify({ ...saved, version: 4 }))).toThrow(
      'Unsupported Show version: 4',
    );
    expect(() => loadShowFile(JSON.stringify({ ...show }))).toThrow(
      'Unsupported Show version: undefined',
    );
  });

  it('loads a version 1 file, which has no default colour or panel Scenes', () => {
    const { defaultColour, panelScenes, ...v1 } = show;
    void defaultColour;
    void panelScenes;

    expect(loadShowFile(JSON.stringify({ version: 1, ...v1 }))).toEqual(v1);
    expect(() => loadShowFile(JSON.stringify({ version: 1, ...show }))).toThrow(
      'Invalid Show:\nunknown field "defaultColour"\nunknown field "panelScenes"',
    );
  });

  it('loads a version 2 file, which has no panel Scenes', () => {
    const { panelScenes, ...v2 } = show;
    void panelScenes;

    expect(loadShowFile(JSON.stringify({ version: 2, ...v2 }))).toEqual(v2);
    expect(() => loadShowFile(JSON.stringify({ version: 2, ...show }))).toThrow(
      'Invalid Show:\nunknown field "panelScenes"',
    );
  });

  it('rejects a file that is not a Show', () => {
    expect(() => loadShowFile(JSON.stringify({ version: 1, scenes: [] }))).toThrow(
      'Invalid Show: layers, scenes and triggers are required',
    );
  });

  it('rejects a file whose Show refers to missing Layers or Scenes', () => {
    const saved = JSON.parse(saveShowFile(show));
    saved.layers.pop();
    saved.triggers[0].scene = 'chorus';
    saved.baseLook = 'outro';
    saved.panelScenes = ['intro'];

    expect(() => loadShowFile(JSON.stringify(saved))).toThrow(
      [
        'Invalid Show:',
        'Scene "Hit": Layer "accents" is not in the Show',
        'Trigger 1/60: Scene "chorus" is not in the Show',
        'Base Look: Scene "outro" is not in the Show',
        'Fallback Panel: Scene "intro" is not in the Show',
      ].join('\n'),
    );
  });

  it('rejects malformed files with a readable error', () => {
    const saved = JSON.parse(saveShowFile(show));
    delete saved.scenes[0].rules[0].target;

    expect(() => loadShowFile(JSON.stringify(saved))).toThrow(
      'Invalid Show:\na Layer, Scene, Rule or Trigger is missing fields',
    );
    expect(() => loadShowFile('null')).toThrow(/^Invalid Show: /);
    expect(() => loadShowFile('{"version": 1,')).toThrow(/^Invalid Show: /);
  });

  it('refuses to save an invalid Show', () => {
    expect(() => saveShowFile({ ...show, baseLook: 'outro' })).toThrow(
      'Invalid Show:\nBase Look: Scene "outro" is not in the Show',
    );
  });

  it('rejects a file with fields the Show model does not have', () => {
    const saved = JSON.parse(saveShowFile(show));
    saved.scenes[0].rules[1].fixtureId = 'par-1';
    saved.scenes[0].rules[1].target.zones[0].dmx = 255;
    saved.triggers[2].velocity = 100;
    saved.defaultColour.value = 1;
    saved.author = 'someone';

    expect(() => loadShowFile(JSON.stringify(saved))).toThrow(
      [
        'Invalid Show:',
        'unknown field "author"',
        'unknown field "defaultColour.value"',
        'unknown field "scenes[0].rules[1].fixtureId"',
        'unknown field "scenes[0].rules[1].target.zones[0].dmx"',
        'unknown field "triggers[2].velocity"',
      ].join('\n'),
    );
  });
});
