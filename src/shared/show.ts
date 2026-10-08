// The Show model: the venue-independent part of a project. Shared because the
// engine runs it and the editor shows it.
//
// Scenes target Zones × Roles, never Fixtures, and hold no raw DMX values, so
// the same Show runs against any Venue Patch (ADR 0001).
import { ROLES, type Role } from './fixture-profile';
import {
  fixtureRole,
  fixtureZone,
  isZone,
  sameZone,
  type PatchedFixture,
  type VenuePatch,
  type Zone,
} from './venue-patch';

// Named colours for a Rule, translated per Fixture by the engine.
export const SWATCHES = [
  'Red',
  'Orange',
  'Amber',
  'Yellow',
  'Green',
  'Cyan',
  'Blue',
  'Lavender',
  'Magenta',
  'Pink',
  'White',
  'Warm White',
  'UV',
] as const;
export type Swatch = (typeof SWATCHES)[number];

// hue in degrees, 0 to under 360; saturation 0–1.
export type Colour = { hue: number; saturation: number } | { swatch: Swatch };

// Named aims for moving Fixtures, computed per Fixture from its stage
// position and Mounting (ADR 0007).
export const DIRECTIONS = ['Down', 'Audience', 'Up', 'Cross', 'Centre', 'Out'] as const;
export type Direction = (typeof DIRECTIONS)[number];

// Where moving Fixtures aim when neither a Rule nor the Show sets a Direction.
export const DEFAULT_DIRECTION: Direction = 'Down';

// Movement Effects, run around a moving Fixture's base aim to the Tempo.
// Ballyhoo is a smooth random wander, the same each time for a Fixture.
export const EFFECT_SHAPES = ['Circle', 'Pan sweep', 'Tilt sweep', 'Ballyhoo'] as const;
export type EffectShape = (typeof EFFECT_SHAPES)[number];

// Beats per cycle.
export const EFFECT_LENGTHS = [1, 2, 4, 8, 16] as const;
export type EffectLength = (typeof EFFECT_LENGTHS)[number];

// The largest Effect size, in degrees.
export const MAX_EFFECT_SIZE = 180;

// Quick picks for an Effect's size, in degrees.
export const EFFECT_SIZES = { Small: 5, Medium: 12, Large: 25 } as const;

// How an Effect is offset across the Fixtures it targets, by stage position:
// Left→Right as the audience sees it, from Stage Right; Mirrored from centre
// out; Alternate every other Fixture across.
export const SPREADS = ['In sync', 'Left→Right', 'Mirrored', 'Alternate'] as const;
export type Spread = (typeof SPREADS)[number];

export interface MovementEffect {
  shape: EffectShape;
  // Degrees from the base aim: over 0, at most `MAX_EFFECT_SIZE`.
  size: number;
  length: EffectLength;
  spread: Spread;
}

// The Fixtures a Rule applies to: those in one of `zones` with one of
// `roles`. An absent list means every Zone or every Role.
export interface RuleTarget {
  zones?: Zone[];
  roles?: Role[];
}

// One part of a Scene. An absent setting leaves the attribute to earlier
// Rules and other Scenes.
export interface Rule {
  target: RuleTarget;
  // 0–1.
  intensity?: number;
  colour?: Colour;
  // Aims the moving Fixtures targeted.
  direction?: Direction;
  // Moves the moving Fixtures targeted around their aim.
  effect?: MovementEffect;
}

// A slot that holds at most one active Scene.
export interface Layer {
  // Unique in the Show.
  id: string;
  name: string;
}

export interface Scene {
  // Unique in the Show.
  id: string;
  name: string;
  tags: string[];
  // A Layer id.
  layer: string;
  // Seconds.
  fadeIn: number;
  // Later Rules override earlier ones.
  rules: Rule[];
}

export const TRIGGER_MODES = ['go', 'flash', 'release'] as const;
export type TriggerMode = (typeof TRIGGER_MODES)[number];

// A note on a MIDI channel.
export interface MidiNote {
  // MIDI channel 1–16.
  channel: number;
  // MIDI note 0–127.
  note: number;
}

// A MIDI note mapped to a Scene action. Release clears the Scene's Layer.
export interface Trigger extends MidiNote {
  // A Scene id.
  scene: string;
  mode: TriggerMode;
}

export interface Show {
  // In display order.
  layers: Layer[];
  scenes: Scene[];
  triggers: Trigger[];
  // The Scene id of the Base Look.
  baseLook?: string;
  // The colour Fixtures show where no Rule sets one. White when absent.
  defaultColour?: Colour;
  // The Direction moving Fixtures aim at where no Rule sets one. Down when
  // absent.
  defaultDirection?: Direction;
  // The Scene ids on the Fallback Panel's buttons, in order. None when absent.
  panelScenes?: string[];
}

// The Fallback Panel's Scene buttons, one per shortcut key 1–9.
export const MAX_PANEL_SCENES = 9;

export type ShowResult = { show: Show } | { errors: string[] };

// Whether a Rule applies to a patched Fixture: in one of its Zones and with
// one of its Roles, either absent meaning any.
export function ruleTargets(patch: VenuePatch, fixture: PatchedFixture, { target }: Rule): boolean {
  const zone = fixtureZone(patch, fixture);
  const role = fixtureRole(patch, fixture);
  const inZone = !target.zones || target.zones.some((z) => sameZone(z, zone));
  return inZone && (!target.roles || target.roles.includes(role));
}

// A new Show with one Layer.
export function emptyShow(): Show {
  return { layers: [{ id: 'layer-1', name: 'Layer 1' }], scenes: [], triggers: [] };
}

// Adds a Scene, or replaces the one with the same id.
export function putScene(show: Show, scene: Scene): ShowResult {
  return validated({ ...show, scenes: put(show.scenes, scene, (s) => s.id === scene.id) });
}

// Removes a Scene with the Triggers that fire it and its Fallback Panel
// button. If it was the Base Look, the Show is left without one.
export function removeScene(show: Show, id: string): Show {
  const { baseLook, panelScenes, ...rest } = show;
  const panel = panelScenes?.filter((s) => s !== id) ?? [];
  return {
    ...rest,
    scenes: show.scenes.filter((s) => s.id !== id),
    triggers: show.triggers.filter((t) => t.scene !== id),
    ...(baseLook !== undefined && baseLook !== id ? { baseLook } : {}),
    ...(panel.length > 0 ? { panelScenes: panel } : {}),
  };
}

// Adds a Layer at the end, or replaces the one with the same id in place.
export function putLayer(show: Show, layer: Layer): ShowResult {
  return validated({ ...show, layers: put(show.layers, layer, (l) => l.id === layer.id) });
}

// Removes a Layer together with its Scenes.
export function removeLayer(show: Show, id: string): Show {
  const layers = show.layers.filter((l) => l.id !== id);
  const onLayer = show.scenes.filter((s) => s.layer === id);
  return onLayer.reduce((rest, scene) => removeScene(rest, scene.id), { ...show, layers });
}

export function sameNote(a: MidiNote, b: MidiNote): boolean {
  return a.channel === b.channel && a.note === b.note;
}

// The Trigger mapped to a channel and note, if any.
export function findTrigger(show: Show, note: MidiNote): Trigger | undefined {
  return show.triggers.find((t) => sameNote(t, note));
}

// Maps a channel and note, replacing the Trigger already on them.
export function putTrigger(show: Show, trigger: Trigger): ShowResult {
  return validated({ ...show, triggers: put(show.triggers, trigger, (t) => sameNote(t, trigger)) });
}

export function removeTrigger(show: Show, note: MidiNote): Show {
  return { ...show, triggers: show.triggers.filter((t) => !sameNote(t, note)) };
}

// Designates a Scene as the Base Look; undefined leaves the Show without one.
export function setBaseLook(show: Show, sceneId: string | undefined): ShowResult {
  const next = { ...show, baseLook: sceneId };
  if (sceneId === undefined) delete next.baseLook;
  return validated(next);
}

// Sets the colour Fixtures show where no Rule sets one; undefined leaves it
// White.
export function setDefaultColour(show: Show, colour: Colour | undefined): ShowResult {
  const next = { ...show, defaultColour: colour };
  if (colour === undefined) delete next.defaultColour;
  return validated(next);
}

// Sets the Direction moving Fixtures aim at where no Rule sets one;
// undefined leaves it Down.
export function setDefaultDirection(show: Show, direction: Direction | undefined): ShowResult {
  const next = { ...show, defaultDirection: direction };
  if (direction === undefined) delete next.defaultDirection;
  return validated(next);
}

// Sets the Scenes on the Fallback Panel's buttons, in order; an empty list
// leaves it without any.
export function setPanelScenes(show: Show, sceneIds: string[]): ShowResult {
  const next: Show = { ...show, panelScenes: sceneIds };
  if (sceneIds.length === 0) delete next.panelScenes;
  return validated(next);
}

// `items` with `item` in place of the one matching `same`, or appended.
function put<T>(items: T[], item: T, same: (other: T) => boolean): T[] {
  return items.some(same) ? items.map((other) => (same(other) ? item : other)) : [...items, item];
}

function validated(show: Show): ShowResult {
  const errors = validateShow(show);
  return errors.length > 0 ? { errors } : { show };
}

// Checks a whole Show. Returns readable errors; an empty list means it is
// valid.
export function validateShow(show: Show): string[] {
  const errors: string[] = [];
  for (const id of duplicates(show.layers.map((l) => l.id))) {
    errors.push(`Layer id "${id}" is used twice`);
  }
  for (const scene of show.scenes) {
    for (const problem of sceneProblems(show, scene)) {
      errors.push(`Scene "${scene.name}"${problem}`);
    }
  }
  for (const id of duplicates(show.scenes.map((s) => s.id))) {
    errors.push(`Scene id "${id}" is used twice`);
  }
  for (const trigger of show.triggers) {
    for (const problem of triggerProblems(show, trigger)) {
      errors.push(`Trigger ${trigger.channel}/${trigger.note}: ${problem}`);
    }
  }
  for (const key of duplicates(show.triggers.map((t) => `${t.channel}/${t.note}`))) {
    errors.push(`Trigger ${key} is mapped twice`);
  }
  if (show.baseLook !== undefined && !hasScene(show, show.baseLook)) {
    errors.push(`Base Look: Scene "${show.baseLook}" is not in the Show`);
  }
  if (show.defaultColour !== undefined) {
    for (const problem of colourProblems(show.defaultColour)) {
      errors.push(`Default colour: ${problem}`);
    }
  }
  if (show.defaultDirection !== undefined) {
    for (const problem of directionProblems(show.defaultDirection)) {
      errors.push(`Default Direction: ${problem}`);
    }
  }
  for (const problem of panelProblems(show, show.panelScenes ?? [])) {
    errors.push(`Fallback Panel: ${problem}`);
  }
  return errors;
}

// Problems with a Scene, each starting with ': ' or ' Rule <n>: '.
function sceneProblems(show: Show, { layer, fadeIn, tags, rules }: Scene): string[] {
  const problems: string[] = [];
  if (!show.layers.some((l) => l.id === layer)) {
    problems.push(`: Layer "${layer}" is not in the Show`);
  }
  if (!Number.isFinite(fadeIn) || fadeIn < 0) problems.push(': fade-in must be 0 seconds or more');
  for (const tag of tags) {
    if (tag === '') problems.push(': tag "" is empty');
    else if (tag.trim() !== tag) problems.push(`: tag "${tag}" has surrounding spaces`);
  }
  for (const tag of duplicates(tags)) problems.push(`: tag "${tag}" is listed twice`);
  rules.forEach((rule, i) => {
    for (const problem of ruleProblems(rule)) problems.push(` Rule ${i + 1}: ${problem}`);
  });
  return problems;
}

function triggerProblems(show: Show, { channel, note, scene, mode }: Trigger): string[] {
  const problems: string[] = [];
  if (!isWhole(channel, 1, 16)) problems.push('channel must be a whole number from 1 to 16');
  if (!isWhole(note, 0, 127)) problems.push('note must be a whole number from 0 to 127');
  if (!hasScene(show, scene)) problems.push(`Scene "${scene}" is not in the Show`);
  if (!TRIGGER_MODES.includes(mode)) problems.push(`mode "${mode}" is not go, flash or release`);
  return problems;
}

function panelProblems(show: Show, sceneIds: string[]): string[] {
  const problems: string[] = [];
  for (const id of sceneIds) {
    if (!hasScene(show, id)) problems.push(`Scene "${id}" is not in the Show`);
  }
  for (const id of duplicates(sceneIds)) problems.push(`Scene "${id}" is listed twice`);
  if (sceneIds.length > MAX_PANEL_SCENES) problems.push(`at most ${MAX_PANEL_SCENES} Scenes`);
  return problems;
}

function hasScene(show: Show, id: string): boolean {
  return show.scenes.some((s) => s.id === id);
}

function ruleProblems({ target, intensity, colour, direction, effect }: Rule): string[] {
  const problems: string[] = [];
  const { zones, roles } = target;
  if (zones?.length === 0) problems.push('Zone list is empty');
  for (const zone of zones ?? []) {
    if (!isZone(zone)) {
      problems.push(`Zone ${zone.row}/${zone.column}/${zone.level} is not on the stage grid`);
    }
  }
  if (roles?.length === 0) problems.push('Role list is empty');
  for (const role of roles ?? []) {
    if (!ROLES.includes(role)) problems.push(`Role "${role}" is not a Role`);
  }
  if (intensity !== undefined && !inRange(intensity, 0, 1)) {
    problems.push('intensity must be from 0 to 1');
  }
  if (colour !== undefined) problems.push(...colourProblems(colour));
  if (direction !== undefined) problems.push(...directionProblems(direction));
  if (effect !== undefined) problems.push(...effectProblems(effect));
  return problems;
}

// Whether `size` is a movement Effect size: over 0, at most
// `MAX_EFFECT_SIZE`.
export function isEffectSize(size: number): boolean {
  return inRange(size, 0, MAX_EFFECT_SIZE) && size > 0;
}

function effectProblems({ shape, size, length, spread }: MovementEffect): string[] {
  const problems: string[] = [];
  if (!EFFECT_SHAPES.includes(shape)) problems.push(`"${shape}" is not a movement Effect shape`);
  if (!isEffectSize(size)) {
    problems.push(`Effect size must be over 0 and at most ${MAX_EFFECT_SIZE} degrees`);
  }
  if (!EFFECT_LENGTHS.includes(length)) {
    const lengths = EFFECT_LENGTHS.join(', ').replace(/, (\d+)$/, ' or $1');
    problems.push(`Effect length must be ${lengths} beats`);
  }
  if (!SPREADS.includes(spread)) problems.push(`"${spread}" is not a Spread`);
  return problems;
}

function directionProblems(direction: Direction): string[] {
  return DIRECTIONS.includes(direction) ? [] : [`"${direction}" is not a Direction`];
}

function colourProblems(colour: Colour): string[] {
  if ('swatch' in colour) {
    return SWATCHES.includes(colour.swatch) ? [] : [`"${colour.swatch}" is not a swatch`];
  }
  const problems: string[] = [];
  if (!inRange(colour.hue, 0, 360) || colour.hue === 360) {
    problems.push('hue must be from 0 to under 360');
  }
  if (!inRange(colour.saturation, 0, 1)) problems.push('saturation must be from 0 to 1');
  return problems;
}

function isWhole(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

// False for NaN and non-numbers.
function inRange(value: number, min: number, max: number): boolean {
  return typeof value === 'number' && value >= min && value <= max;
}

function duplicates<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const repeated = new Set<T>();
  for (const value of values) (seen.has(value) ? repeated : seen).add(value);
  return [...repeated];
}
