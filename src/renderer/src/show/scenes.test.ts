import { describe, expect, it } from 'vitest';
import type { Scene } from '../../../shared/show';
import { filterScenes, freeId, isActive, parseTags, sceneTags } from './scenes';

const scene = (id: string, name: string, tags: string[] = []): Scene => ({
  id,
  name,
  tags,
  layer: 'layer-1',
  fadeIn: 0,
  rules: [],
});

const SCENES = [
  scene('a', 'Warm wash', ['verse']),
  scene('b', 'Strobe hit', ['chorus', 'loud']),
  scene('c', 'Blue verse', ['chorus']),
];
const names = (scenes: Scene[]) => scenes.map((s) => s.name);

describe('filterScenes', () => {
  it('keeps every Scene without a query or tag', () => {
    expect(filterScenes(SCENES, { query: '', tag: undefined })).toEqual(SCENES);
  });

  it('matches the name, ignoring case and surrounding spaces', () => {
    expect(names(filterScenes(SCENES, { query: '  VERSE ' }))).toEqual(['Blue verse']);
  });

  it('keeps only Scenes with the tag, and the query narrows them', () => {
    expect(names(filterScenes(SCENES, { query: '', tag: 'chorus' }))).toEqual([
      'Strobe hit',
      'Blue verse',
    ]);
    expect(names(filterScenes(SCENES, { query: 'blue', tag: 'chorus' }))).toEqual(['Blue verse']);
  });
});

describe('sceneTags', () => {
  it('lists each tag once, sorted', () => {
    expect(sceneTags(SCENES)).toEqual(['chorus', 'loud', 'verse']);
  });
});

describe('parseTags', () => {
  it('splits on commas, trims and drops empty and repeated tags', () => {
    expect(parseTags(' verse, chorus,,verse , ')).toEqual(['verse', 'chorus']);
    expect(parseTags('')).toEqual([]);
  });
});

describe('freeId', () => {
  it('takes the lowest number no item uses', () => {
    expect(freeId('scene', [])).toBe('scene-1');
    expect(freeId('scene', [{ id: 'scene-1' }, { id: 'scene-3' }])).toBe('scene-2');
  });
});

describe('isActive', () => {
  it("is true only for the active Scene in the Scene's own Layer", () => {
    const warm = scene('a', 'Warm');
    expect(isActive({ 'layer-1': 'a' }, warm)).toBe(true);
    expect(isActive({ 'layer-1': 'b' }, warm)).toBe(false);
    expect(isActive({ 'layer-2': 'a' }, warm)).toBe(false);
  });
});
