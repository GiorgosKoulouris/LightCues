// Scene logic for the Show view, Perform and the Fallback Panel. Pure, so it
// is testable without a DOM.
import type { ActiveByLayer, EngineCommand } from '../../../shared/protocol';
import type { Scene, Show } from '../../../shared/show';

export interface SceneFilter {
  // Matched against the name, ignoring case.
  query: string;
  // Only Scenes with this tag; every Scene when undefined.
  tag?: string;
}

export function filterScenes(scenes: readonly Scene[], { query, tag }: SceneFilter): Scene[] {
  const needle = query.trim().toLowerCase();
  return scenes.filter(
    (scene) =>
      (tag === undefined || scene.tags.includes(tag)) && scene.name.toLowerCase().includes(needle),
  );
}

// Whether `scene` is the active Scene in its Layer.
export function isActive(active: ActiveByLayer, scene: Scene): boolean {
  return active[scene.layer] === scene.id;
}

// What a Scene button sends: Go, or a clear of the Scene's Layer when it is
// already active there, the same as a Release.
export function pressScene(active: ActiveByLayer, scene: Scene): EngineCommand {
  return isActive(active, scene)
    ? { type: 'clearLayer', layerId: scene.layer }
    : { type: 'goScene', sceneId: scene.id };
}

// Every tag the Scenes use, once each, sorted.
export function sceneTags(scenes: readonly Scene[]): string[] {
  return [...new Set(scenes.flatMap((s) => s.tags))].sort();
}

// Comma-separated, trimmed, without empty or repeated tags.
export function parseTags(text: string): string[] {
  return [...new Set(text.split(',').map((t) => t.trim()))].filter((t) => t !== '');
}

// `<prefix>-<n>` with the lowest n no item uses.
export function freeId(prefix: string, items: readonly { id: string }[]): string {
  let n = 1;
  while (items.some((item) => item.id === `${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}

// A Scene's name, or its id when the Show has no such Scene.
export function sceneName(show: Show, id: string): string {
  return show.scenes.find((s) => s.id === id)?.name ?? id;
}

// A Layer's name, or its id when the Show has no such Layer.
export function layerName(show: Show, id: string): string {
  return show.layers.find((l) => l.id === id)?.name ?? id;
}
