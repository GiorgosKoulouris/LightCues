// The Show model: the venue-independent part of a project. Shared because the
// engine runs it and the editor shows it.
//
// Scenes target Zones × Roles, never Fixtures, and hold no raw DMX values, so
// the same Show runs against any Venue Patch (ADR 0001).
import { colourProblems, inRange, type Colour } from './colour';
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

export { SWATCHES, type Colour, type Swatch } from './colour';

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

// Beats per cycle, for every kind of Effect.
export const EFFECT_LENGTHS = [0.25, 0.5, 1, 2, 4, 8, 16] as const;
export type EffectLength = (typeof EFFECT_LENGTHS)[number];

// A number of beats as shown: 1/4, 1/2, 1, 2 and so on.
export function beatsLabel(beats: number): string {
  return beats < 1 ? `1/${1 / beats}` : String(beats);
}

// The largest Effect size, in degrees.
export const MAX_EFFECT_SIZE = 180;

// Quick picks for an Effect's size, in degrees.
export const EFFECT_SIZES = { Small: 5, Medium: 12, Large: 25 } as const;

// How an Effect is offset across the Fixtures it targets, by stage position:
// Left→Right as the audience sees it, from Stage Right; Mirrored from centre
// out; Alternate every other Fixture across.
export const SPREADS = ['In sync', 'Left→Right', 'Mirrored', 'Alternate'] as const;
export type Spread = (typeof SPREADS)[number];

// An Effect slot set to None stops the Effect of that kind from earlier Rules
// and lower Layers.
export const NO_EFFECT = 'None';
export type EffectSlot<E> = E | typeof NO_EFFECT;

export interface MovementEffect {
  shape: EffectShape;
  // Degrees from the base aim: over 0, at most `MAX_EFFECT_SIZE`.
  size: number;
  length: EffectLength;
  spread: Spread;
}

// How fast a Fixture strobes: Off, a named rate, or once per 1, 1/2 or 1/4
// beat of the Tempo. Off stops strobe from earlier Rules and lower Layers.
export const STROBE_RATES = ['Off', 'Slow', 'Medium', 'Fast', 1, 0.5, 0.25] as const;
export type StrobeRate = (typeof STROBE_RATES)[number];

// The named strobe rates, in Hz.
export const STROBE_HZ = { Slow: 2, Medium: 6, Fast: 12 } as const;

// The Fixtures a Rule applies to: those in one of `zones` with one of
// `roles`. An absent list means every Zone or every Role.
export interface RuleTarget {
  zones?: Zone[];
  roles?: Role[];
}

// One part of a Scene. An absent setting leaves the attribute to earlier
// Rules and other Scenes. A Rule has an Effect slot per kind: movement,
// intensity and colour.
export interface Rule {
  target: RuleTarget;
  // 0–1.
  intensity?: number;
  colour?: Colour;
  // Aims the moving Fixtures targeted.
  direction?: Direction;
  // Moves the moving Fixtures targeted around their aim. None holds them
  // still.
  movementEffect?: EffectSlot<MovementEffect>;
  // None only, until intensity and colour Effects are defined.
  intensityEffect?: typeof NO_EFFECT;
  colourEffect?: typeof NO_EFFECT;
  // Strobes the Fixtures targeted that have a strobe channel.
  strobe?: StrobeRate;
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

// A named slot the House Lights go to, with the house look each Venue Patch
// gives it (ADR 0013). Its note only does Go.
export interface HousePreset {
  // Unique in the Show; Venue Patches key their house looks by it.
  id: string;
  name: string;
  // Seconds to crossfade from the current house state.
  fade: number;
  note?: MidiNote;
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
  // In order, at most `MAX_HOUSE_PRESETS`. None when absent.
  housePresets?: HousePreset[];
}

// The Fallback Panel's Scene buttons, one per shortcut key 1–9.
export const MAX_PANEL_SCENES = 9;

// The House Preset slots, one per Fallback Panel shortcut Shift+1–8.
export const MAX_HOUSE_PRESETS = 8;

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

export function showHousePresets(show: Show): HousePreset[] {
  return show.housePresets ?? [];
}

export function findHousePreset(show: Show, id: string): HousePreset | undefined {
  return showHousePresets(show).find((p) => p.id === id);
}

// The House Preset a channel and note fire, if any.
export function findHousePresetOn(show: Show, note: MidiNote): HousePreset | undefined {
  return showHousePresets(show).find((p) => p.note !== undefined && sameNote(p.note, note));
}

// Adds a House Preset at the end, or replaces the one with the same id in
// place.
export function putHousePreset(show: Show, preset: HousePreset): ShowResult {
  const presets = put(showHousePresets(show), preset, (p) => p.id === preset.id);
  return validated({ ...show, housePresets: presets });
}

// Moves a House Preset to index `to`.
export function moveHousePreset(show: Show, id: string, to: number): Show {
  const presets = [...showHousePresets(show)];
  const from = presets.findIndex((p) => p.id === id);
  if (from < 0) return show;
  presets.splice(to, 0, ...presets.splice(from, 1));
  return { ...show, housePresets: presets };
}

// Removes a House Preset; without any left, the Show has no list.
export function removeHousePreset(show: Show, id: string): Show {
  const { housePresets, ...rest } = show;
  const left = (housePresets ?? []).filter((p) => p.id !== id);
  return left.length > 0 ? { ...rest, housePresets: left } : rest;
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
  errors.push(...housePresetErrors(show));
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
  const problems = noteProblems({ channel, note });
  if (!hasScene(show, scene)) problems.push(`Scene "${scene}" is not in the Show`);
  if (!TRIGGER_MODES.includes(mode)) problems.push(`mode "${mode}" is not go, flash or release`);
  return problems;
}

function noteProblems({ channel, note }: MidiNote): string[] {
  const problems: string[] = [];
  if (!isWhole(channel, 1, 16)) problems.push('channel must be a whole number from 1 to 16');
  if (!isWhole(note, 0, 127)) problems.push('note must be a whole number from 0 to 127');
  return problems;
}

// A House Preset note may not also be a Trigger's, so a note does one thing.
function housePresetErrors(show: Show): string[] {
  const presets = showHousePresets(show);
  const errors: string[] = [];
  for (const { id, name, fade, note } of presets) {
    const at = `House Preset "${name}": `;
    // Venue Patches key their house looks by the id.
    if (typeof id !== 'string' || id === '') errors.push(`${at}id is missing`);
    if (typeof name !== 'string' || name.trim() === '') errors.push(`${at}name is empty`);
    if (!Number.isFinite(fade) || fade < 0) errors.push(`${at}fade must be 0 seconds or more`);
    if (note === undefined) continue;
    errors.push(...noteProblems(note).map((problem) => at + problem));
    if (findTrigger(show, note)) {
      errors.push(`${at}note ${note.channel}/${note.note} is also a Trigger`);
    }
  }
  for (const id of duplicates(presets.map((p) => p.id))) {
    errors.push(`House Preset id "${id}" is used twice`);
  }
  const notes = presets.flatMap(({ note }) => (note ? [`${note.channel}/${note.note}`] : []));
  for (const key of duplicates(notes)) errors.push(`House Preset note ${key} is used twice`);
  if (presets.length > MAX_HOUSE_PRESETS) {
    errors.push(`House Presets: at most ${MAX_HOUSE_PRESETS}`);
  }
  return errors;
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

function ruleProblems(rule: Rule): string[] {
  const { target, intensity, colour, direction, strobe } = rule;
  const { movementEffect, intensityEffect, colourEffect } = rule;
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
  if (strobe !== undefined && !STROBE_RATES.includes(strobe)) {
    problems.push('strobe must be Off, Slow, Medium, Fast, or 1, 1/2 or 1/4 beat');
  }
  if (movementEffect !== undefined && movementEffect !== NO_EFFECT) {
    if (typeof movementEffect === 'object' && movementEffect !== null) {
      problems.push(...effectProblems(movementEffect));
    } else {
      problems.push('movement Effect must be None or an Effect');
    }
  }
  if (intensityEffect !== undefined && intensityEffect !== NO_EFFECT) {
    problems.push('intensity Effect must be None');
  }
  if (colourEffect !== undefined && colourEffect !== NO_EFFECT) {
    problems.push('colour Effect must be None');
  }
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
    const lengths = EFFECT_LENGTHS.map(beatsLabel)
      .join(', ')
      .replace(/, (\d+)$/, ' or $1');
    problems.push(`Effect length must be ${lengths} beats`);
  }
  if (!SPREADS.includes(spread)) problems.push(`"${spread}" is not a Spread`);
  return problems;
}

function directionProblems(direction: Direction): string[] {
  return DIRECTIONS.includes(direction) ? [] : [`"${direction}" is not a Direction`];
}

function isWhole(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function duplicates<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const repeated = new Set<T>();
  for (const value of values) (seen.has(value) ? repeated : seen).add(value);
  return [...repeated];
}
