import { describe, expect, it } from 'vitest';
import {
  emptyShow,
  putLayer,
  putScene,
  putTrigger,
  removeLayer,
  removeScene,
  removeTrigger,
  setBaseLook,
  validateShow,
  type Rule,
  type Scene,
  type Show,
  type Trigger,
} from './show';

function scene(overrides: Partial<Scene>): Scene {
  return { id: 's1', name: 'Scene', tags: [], layer: 'l1', fadeIn: 0, rules: [], ...overrides };
}

function show(...scenes: Scene[]): Show {
  return { layers: [{ id: 'l1', name: 'Layer 1' }], scenes, triggers: [] };
}

describe('validateShow', () => {
  it('accepts Rules with in-range settings', () => {
    const rules: Rule[] = [
      { target: {}, intensity: 0, colour: { hue: 0, saturation: 0 } },
      {
        target: {
          zones: [{ row: 'Front', column: 'Stage Left', level: 'Floor' }],
          roles: ['Strobe'],
        },
        intensity: 1,
        colour: { hue: 359.9, saturation: 1 },
      },
      { target: { roles: ['Effect'] }, colour: { swatch: 'UV' } },
    ];

    expect(validateShow(show(scene({ rules })))).toEqual([]);
  });

  it('rejects Rules with out-of-range settings or unknown targets', () => {
    const rules = [
      { target: { zones: [] }, intensity: 1.5 },
      { target: { roles: [] }, colour: { hue: 360, saturation: 0.5 } },
      { target: {}, intensity: Number.NaN, colour: { hue: 10, saturation: -0.1 } },
      {
        target: {
          zones: [{ row: 'Balcony', column: 'Centre', level: 'Floor' }],
          roles: ['Laser'],
        },
        colour: { swatch: 'Teal' },
      },
    ] as unknown as Rule[];

    expect(validateShow(show(scene({ name: 'Verse', rules })))).toEqual([
      'Scene "Verse" Rule 1: Zone list is empty',
      'Scene "Verse" Rule 1: intensity must be from 0 to 1',
      'Scene "Verse" Rule 2: Role list is empty',
      'Scene "Verse" Rule 2: hue must be from 0 to under 360',
      'Scene "Verse" Rule 3: intensity must be from 0 to 1',
      'Scene "Verse" Rule 3: saturation must be from 0 to 1',
      'Scene "Verse" Rule 4: Zone Balcony/Centre/Floor is not on the stage grid',
      'Scene "Verse" Rule 4: Role "Laser" is not a Role',
      'Scene "Verse" Rule 4: "Teal" is not a swatch',
    ]);
  });

  it('rejects bad fade times, tags and repeated ids', () => {
    const invalid: Show = {
      layers: [
        { id: 'l1', name: 'Layer 1' },
        { id: 'l1', name: 'Layer 1 again' },
      ],
      scenes: [
        scene({ name: 'Verse', fadeIn: -1, tags: ['calm', '', 'calm'] }),
        scene({ name: 'Chorus', fadeIn: Number.POSITIVE_INFINITY, tags: [' loud'] }),
      ],
      triggers: [],
    };

    expect(validateShow(invalid)).toEqual([
      'Layer id "l1" is used twice',
      'Scene "Verse": fade-in must be 0 seconds or more',
      'Scene "Verse": tag "" is empty',
      'Scene "Verse": tag "calm" is listed twice',
      'Scene "Chorus": fade-in must be 0 seconds or more',
      'Scene "Chorus": tag " loud" has surrounding spaces',
      'Scene id "s1" is used twice',
    ]);
  });

  it('rejects Triggers outside MIDI ranges, of unknown modes or on a used note', () => {
    const triggers = [
      { channel: 0, note: 128, scene: 's1', mode: 'go' },
      { channel: 2.5, note: -1, scene: 's1', mode: 'toggle' },
      { channel: 16, note: 127, scene: 's1', mode: 'flash' },
      { channel: 16, note: 127, scene: 's1', mode: 'release' },
    ] as unknown as Trigger[];

    expect(validateShow({ ...show(scene({})), triggers })).toEqual([
      'Trigger 0/128: channel must be a whole number from 1 to 16',
      'Trigger 0/128: note must be a whole number from 0 to 127',
      'Trigger 2.5/-1: channel must be a whole number from 1 to 16',
      'Trigger 2.5/-1: note must be a whole number from 0 to 127',
      'Trigger 2.5/-1: mode "toggle" is not go, flash or release',
      'Trigger 16/127 is mapped twice',
    ]);
  });
});

describe('editing a Show', () => {
  it('starts with one Layer and nothing else', () => {
    expect(emptyShow()).toEqual({
      layers: [{ id: 'layer-1', name: 'Layer 1' }],
      scenes: [],
      triggers: [],
    });
  });

  it('adds a Scene, then replaces it by id', () => {
    const added = putScene(emptyShow(), scene({ layer: 'layer-1', name: 'Verse' }));
    if ('errors' in added) throw new Error(added.errors.join('\n'));
    const replaced = putScene(added.show, scene({ layer: 'layer-1', name: 'Verse 2' }));

    expect(replaced).toEqual({
      show: { ...emptyShow(), scenes: [scene({ layer: 'layer-1', name: 'Verse 2' })] },
    });
  });

  it('refuses a Scene that makes the Show invalid', () => {
    expect(putScene(emptyShow(), scene({ name: 'Verse', layer: 'nope' }))).toEqual({
      errors: ['Scene "Verse": Layer "nope" is not in the Show'],
    });
  });

  it('removes a Scene with its Triggers and its Base Look designation', () => {
    const verse = scene({ id: 'verse', layer: 'layer-1' });
    const hit = scene({ id: 'hit', layer: 'layer-1' });
    const before: Show = {
      ...emptyShow(),
      scenes: [verse, hit],
      triggers: [
        { channel: 1, note: 60, scene: 'verse', mode: 'go' },
        { channel: 1, note: 61, scene: 'hit', mode: 'flash' },
      ],
      baseLook: 'verse',
    };

    expect(removeScene(before, 'verse')).toEqual({
      ...emptyShow(),
      scenes: [hit],
      triggers: [{ channel: 1, note: 61, scene: 'hit', mode: 'flash' }],
    });
    expect(removeScene(before, 'hit').baseLook).toBe('verse');
  });

  it('adds and renames Layers, keeping their order', () => {
    const added = putLayer(emptyShow(), { id: 'accents', name: 'Accents' });
    if ('errors' in added) throw new Error(added.errors.join('\n'));

    expect(putLayer(added.show, { id: 'layer-1', name: 'Base' })).toEqual({
      show: {
        ...emptyShow(),
        layers: [
          { id: 'layer-1', name: 'Base' },
          { id: 'accents', name: 'Accents' },
        ],
      },
    });
  });

  it('removes a Layer with its Scenes and their Triggers', () => {
    const before: Show = {
      layers: [
        { id: 'base', name: 'Base' },
        { id: 'accents', name: 'Accents' },
      ],
      scenes: [scene({ id: 'verse', layer: 'base' }), scene({ id: 'hit', layer: 'accents' })],
      triggers: [
        { channel: 1, note: 60, scene: 'verse', mode: 'go' },
        { channel: 1, note: 61, scene: 'hit', mode: 'flash' },
      ],
      baseLook: 'hit',
    };

    expect(removeLayer(before, 'accents')).toEqual({
      layers: [{ id: 'base', name: 'Base' }],
      scenes: [scene({ id: 'verse', layer: 'base' })],
      triggers: [{ channel: 1, note: 60, scene: 'verse', mode: 'go' }],
    });
  });

  it('maps a note to a Scene, replacing what the note fired before', () => {
    const before: Show = {
      ...emptyShow(),
      scenes: [scene({ id: 'verse', layer: 'layer-1' }), scene({ id: 'hit', layer: 'layer-1' })],
      triggers: [{ channel: 1, note: 60, scene: 'verse', mode: 'go' }],
    };

    expect(putTrigger(before, { channel: 1, note: 60, scene: 'hit', mode: 'flash' })).toEqual({
      show: { ...before, triggers: [{ channel: 1, note: 60, scene: 'hit', mode: 'flash' }] },
    });
    expect(putTrigger(before, { channel: 1, note: 61, scene: 'outro', mode: 'go' })).toEqual({
      errors: ['Trigger 1/61: Scene "outro" is not in the Show'],
    });
    expect(removeTrigger(before, 1, 60)).toEqual({ ...before, triggers: [] });
  });

  it('designates a Scene as the Base Look, or none', () => {
    const before: Show = { ...emptyShow(), scenes: [scene({ id: 'verse', layer: 'layer-1' })] };
    const designated = setBaseLook(before, 'verse');
    if ('errors' in designated) throw new Error(designated.errors.join('\n'));

    expect(designated.show.baseLook).toBe('verse');
    expect(setBaseLook(designated.show, undefined)).toEqual({ show: before });
    expect(setBaseLook(before, 'outro')).toEqual({
      errors: ['Base Look: Scene "outro" is not in the Show'],
    });
  });
});
