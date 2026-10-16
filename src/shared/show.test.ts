import { describe, expect, it } from 'vitest';
import {
  emptyShow,
  moveHousePreset,
  putHousePreset,
  putLayer,
  putScene,
  putTrigger,
  removeHousePreset,
  removeLayer,
  removeScene,
  removeTrigger,
  setBaseLook,
  setDefaultColour,
  setDefaultDirection,
  setPanelScenes,
  validateShow,
  type HousePreset,
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
      { target: {}, direction: 'Audience' },
      {
        target: {},
        movementEffect: { shape: 'Ballyhoo', size: 25, length: 16, spread: 'Alternate' },
      },
      { target: {}, movementEffect: { shape: 'Circle', size: 5, length: 0.25, spread: 'In sync' } },
      { target: {}, movementEffect: { shape: 'Circle', size: 5, length: 0.5, spread: 'In sync' } },
      { target: {}, movementEffect: 'None', intensityEffect: 'None', colourEffect: 'None' },
      {
        target: {},
        intensityEffect: { shape: 'Pulse', depth: 1, length: 0.25, spread: 'Left→Right' },
      },
      { target: {}, intensityEffect: { shape: 'Chase', depth: 0, length: 16, spread: 'Mirrored' } },
      { target: {}, strobe: 'Off' },
      { target: {}, strobe: 'Fast' },
      { target: {}, strobe: 0.25 },
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
        direction: 'Sideways',
      },
      { target: {}, movementEffect: { shape: 'Figure 8', size: 0, length: 3, spread: 'Random' } },
      { target: {}, movementEffect: { shape: 'Circle', size: 181, length: 1, spread: 'In sync' } },
      { target: {}, strobe: 'Strobe' },
      { target: {}, strobe: 2 },
      { target: {}, movementEffect: 'Off', intensityEffect: 'Pulse', colourEffect: null },
      {
        target: {},
        intensityEffect: { shape: 'Flicker', depth: 1.5, length: 3, spread: 'Random' },
      },
      {
        target: {},
        intensityEffect: { shape: 'Square', depth: -0.1, length: 1, spread: 'In sync' },
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
      'Scene "Verse" Rule 4: "Sideways" is not a Direction',
      'Scene "Verse" Rule 5: "Figure 8" is not a movement Effect shape',
      'Scene "Verse" Rule 5: Effect size must be over 0 and at most 180 degrees',
      'Scene "Verse" Rule 5: Effect length must be 1/4, 1/2, 1, 2, 4, 8 or 16 beats',
      'Scene "Verse" Rule 5: "Random" is not a Spread',
      'Scene "Verse" Rule 6: Effect size must be over 0 and at most 180 degrees',
      'Scene "Verse" Rule 7: strobe must be Off, Slow, Medium, Fast, or 1, 1/2 or 1/4 beat',
      'Scene "Verse" Rule 8: strobe must be Off, Slow, Medium, Fast, or 1, 1/2 or 1/4 beat',
      'Scene "Verse" Rule 9: movement Effect must be None or an Effect',
      'Scene "Verse" Rule 9: intensity Effect must be None or an Effect',
      'Scene "Verse" Rule 9: colour Effect must be None',
      'Scene "Verse" Rule 10: "Flicker" is not an intensity Effect shape',
      'Scene "Verse" Rule 10: Effect depth must be from 0 to 1',
      'Scene "Verse" Rule 10: Effect length must be 1/4, 1/2, 1, 2, 4, 8 or 16 beats',
      'Scene "Verse" Rule 10: "Random" is not a Spread',
      'Scene "Verse" Rule 11: Effect depth must be from 0 to 1',
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
      panelScenes: ['verse'],
    };

    expect(removeScene(before, 'verse')).toEqual({
      ...emptyShow(),
      scenes: [hit],
      triggers: [{ channel: 1, note: 61, scene: 'hit', mode: 'flash' }],
    });
    expect(removeScene(before, 'hit')).toMatchObject({ baseLook: 'verse', panelScenes: ['verse'] });
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
    expect(removeTrigger(before, { channel: 1, note: 60 })).toEqual({ ...before, triggers: [] });
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

  it('puts Scenes on the Fallback Panel in order, up to nine, or none', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const before: Show = {
      ...emptyShow(),
      scenes: ids.map((id) => scene({ id, layer: 'layer-1' })),
    };
    const set = setPanelScenes(before, ['c', 'a']);
    if ('errors' in set) throw new Error(set.errors.join('\n'));

    expect(set.show.panelScenes).toEqual(['c', 'a']);
    expect(setPanelScenes(set.show, [])).toEqual({ show: before });
    expect(setPanelScenes(before, ['a', 'a', 'outro'])).toEqual({
      errors: [
        'Fallback Panel: Scene "outro" is not in the Show',
        'Fallback Panel: Scene "a" is listed twice',
      ],
    });
    expect(setPanelScenes(before, ids)).toEqual({
      errors: ['Fallback Panel: at most 9 Scenes'],
    });
  });

  it('sets the default colour, or White without one', () => {
    const before = emptyShow();
    const set = setDefaultColour(before, { swatch: 'Warm White' });
    if ('errors' in set) throw new Error(set.errors.join('\n'));

    expect(set.show.defaultColour).toEqual({ swatch: 'Warm White' });
    expect(setDefaultColour(set.show, undefined)).toEqual({ show: before });
    expect(setDefaultColour(before, { hue: 400, saturation: 1 })).toEqual({
      errors: ['Default colour: hue must be from 0 to under 360'],
    });
  });

  it('sets the Default Direction, or Down without one', () => {
    const before = emptyShow();
    const set = setDefaultDirection(before, 'Audience');
    if ('errors' in set) throw new Error(set.errors.join('\n'));

    expect(set.show.defaultDirection).toBe('Audience');
    expect(setDefaultDirection(set.show, undefined)).toEqual({ show: before });
    expect(setDefaultDirection(before, 'Sideways' as never)).toEqual({
      errors: ['Default Direction: "Sideways" is not a Direction'],
    });
  });
});

describe('House Presets', () => {
  const dim: HousePreset = { id: 'dim', name: 'Dim', fade: 3 };
  const up: HousePreset = { id: 'up', name: 'Up', fade: 5, note: { channel: 2, note: 10 } };

  function withPresets(...housePresets: HousePreset[]): Show {
    return { ...emptyShow(), housePresets };
  }

  function shown(result: ReturnType<typeof putHousePreset>): Show {
    if ('errors' in result) throw new Error(result.errors.join('\n'));
    return result.show;
  }

  it('adds House Presets at the end, then renames and sets fade and note in place', () => {
    const added = shown(putHousePreset(shown(putHousePreset(emptyShow(), dim)), up));
    expect(added.housePresets).toEqual([dim, up]);

    const edited = shown(
      putHousePreset(added, { ...dim, name: 'Show dim', fade: 0.5, note: { channel: 1, note: 0 } }),
    );
    expect(edited.housePresets).toEqual([
      { id: 'dim', name: 'Show dim', fade: 0.5, note: { channel: 1, note: 0 } },
      up,
    ]);
    expect(shown(putHousePreset(edited, { ...up, note: undefined })).housePresets?.[1]).toEqual({
      id: 'up',
      name: 'Up',
      fade: 5,
    });
  });

  it('reorders House Presets', () => {
    const last: HousePreset = { id: 'last', name: 'Last', fade: 0 };
    const before = withPresets(dim, up, last);

    expect(moveHousePreset(before, 'last', 0).housePresets).toEqual([last, dim, up]);
    expect(moveHousePreset(before, 'dim', 2).housePresets).toEqual([up, last, dim]);
  });

  it('removes a House Preset, leaving the Show without the list when it was the last', () => {
    expect(removeHousePreset(withPresets(dim, up), 'dim')).toEqual(withPresets(up));
    expect(removeHousePreset(withPresets(dim), 'dim')).toEqual(emptyShow());
  });

  it('holds at most eight House Presets', () => {
    const eight = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, fade: 0 }));

    expect(validateShow(withPresets(...eight))).toEqual([]);
    expect(putHousePreset(withPresets(...eight), dim)).toEqual({
      errors: ['House Presets: at most 8'],
    });
  });

  it('rejects bad fades, notes outside MIDI ranges and repeated ids', () => {
    const presets = [
      { ...dim, fade: -1 },
      { ...up, fade: Number.NaN, note: { channel: 17, note: 1.5 } },
      { ...dim, name: 'Again' },
      { id: '', name: ' ', fade: 0 },
    ];

    expect(validateShow(withPresets(...presets))).toEqual([
      'House Preset "Dim": fade must be 0 seconds or more',
      'House Preset "Up": fade must be 0 seconds or more',
      'House Preset "Up": channel must be a whole number from 1 to 16',
      'House Preset "Up": note must be a whole number from 0 to 127',
      'House Preset " ": id is missing',
      'House Preset " ": name is empty',
      'House Preset id "dim" is used twice',
    ]);
  });

  it("rejects a note that is another House Preset's", () => {
    const before = withPresets(up);

    expect(putHousePreset(before, { ...dim, note: { channel: 2, note: 10 } })).toEqual({
      errors: ['House Preset note 2/10 is used twice'],
    });
  });

  it("rejects a House Preset on a Trigger's note, and a Trigger on a House Preset's", () => {
    const withTrigger: Show = {
      ...emptyShow(),
      scenes: [scene({ id: 'verse', layer: 'layer-1' })],
      triggers: [{ channel: 1, note: 60, scene: 'verse', mode: 'go' }],
    };
    const clash = { ...dim, note: { channel: 1, note: 60 } };

    expect(putHousePreset(withTrigger, clash)).toEqual({
      errors: ['House Preset "Dim": note 1/60 is also a Trigger'],
    });
    expect(
      putTrigger({ ...withTrigger, triggers: [], housePresets: [clash] }, withTrigger.triggers[0]!),
    ).toEqual({ errors: ['House Preset "Dim": note 1/60 is also a Trigger'] });
  });
});
