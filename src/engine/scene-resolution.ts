// Scene resolution: the active Scenes of a Show, resolved against a Venue
// Patch, as one DMX frame per Universe. Pure, so it is testable without
// hardware.
import { aimAt, aimDmx, turnAim, type AimAngles, type Turn } from '../shared/aim';
import { dmxByte, fixed, toDmx, type Point } from '../shared/dmx-point';
import type { CapabilityRange, Channel, Emitter } from '../shared/fixture-profile';
import type { FixtureLight } from '../shared/protocol';
import {
  DEFAULT_DIRECTION,
  ruleTargets,
  type Colour,
  type Direction,
  type Scene,
  type Show,
  type Swatch,
} from '../shared/show';
import { effectTurn, spreadDelay } from './movement-effects';
import {
  DMX_CHANNELS,
  fixtureMode,
  fixtureMounting,
  isMovingFixture,
  type PatchedFixture,
  type VenuePatch,
} from '../shared/venue-patch';

// The Scene a Layer shows, since `since` (seconds). Until the Scene's fade-in
// is over, the Layer crossfades from `from`, what it showed before; a Layer
// that was clear has no `from`. `shown` is what each moving Fixture showed at
// activation, by Fixture id: where a move starts, and which pan it stays near.
export interface ActiveScene {
  scene: string;
  since: number;
  from?: ActiveScene;
  shown?: Record<string, ShownAim>;
}

// A moving Fixture's aim at activation: its pan and tilt, the Direction they
// aim at, and whether it was dark then.
export interface ShownAim extends AimAngles {
  direction: Direction;
  dark: boolean;
}

// Keyed by Layer id. A Layer without an entry is clear.
export type ActiveScenes = Record<string, ActiveScene>;

// Activates a Scene at `time`, replacing the active Scene in its Layer. It
// keeps what each moving Fixture in the Venue Patch shows then, under the
// Grand Master and at `beat` of the Tempo.
export function activate(
  active: ActiveScenes,
  show: Show,
  patch: VenuePatch,
  sceneId: string,
  time: number,
  grandMaster = 1,
  beat = 0,
): ActiveScenes {
  const scene = findScene(show, sceneId);
  if (!scene) return active;
  const from = active[scene.layer];
  const entry: ActiveScene = {
    scene: sceneId,
    since: time,
    shown: shownAims(show, patch, active, time, grandMaster, beat),
  };
  // A finished fade no longer needs what it faded from.
  if (from) entry.from = fading(show, from, time) ? from : { scene: from.scene, since: from.since };
  return { ...active, [scene.layer]: entry };
}

// What each moving Fixture shows at `time`, by Fixture id.
function shownAims(
  show: Show,
  patch: VenuePatch,
  active: ActiveScenes,
  time: number,
  grandMaster: number,
  beat: number,
): Record<string, ShownAim> {
  const shown: Record<string, ShownAim> = {};
  for (const fixture of patch.fixtures) {
    const { output } = fixtureOutput(show, patch, active, fixture, time, grandMaster, beat);
    const { aim, direction, intensity } = output;
    if (aim && direction) shown[fixture.id] = { ...aim, direction, dark: intensity === 0 };
  }
  return shown;
}

// Clears a Layer at once, without a fade.
export function clearLayer(active: ActiveScenes, layerId: string): ActiveScenes {
  return Object.fromEntries(Object.entries(active).filter(([id]) => id !== layerId));
}

// Whether a Layer is still crossfading at `time`.
function fading(show: Show, { scene, since, from }: ActiveScene, time: number): boolean {
  return from !== undefined && progress(show, scene, since, time) < 1;
}

// How far into its fade-in a Scene activated at `since` is, 0–1.
function progress(show: Show, sceneId: string, since: number, time: number): number {
  const fadeIn = findScene(show, sceneId)?.fadeIn ?? 0;
  return fadeIn > 0 ? clamp((time - since) / fadeIn) : 1;
}

function findScene(show: Show, id: string): Scene | undefined {
  return show.scenes.find((s) => s.id === id);
}

export function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

// One frame per Universe in the patch, channel 1 first, at `time` (seconds).
// The Grand Master (0–1) scales intensity after the Layers are combined.
// Movement Effects run at `beat`, the Tempo's beat count.
export function resolveFrames(
  show: Show,
  patch: VenuePatch,
  active: ActiveScenes,
  time: number,
  grandMaster = 1,
  beat = 0,
): Map<number, Uint8Array> {
  const frames = new Map(patch.universes.map((u) => [u.number, new Uint8Array(DMX_CHANNELS)]));
  for (const fixture of patch.fixtures) {
    const resolved = fixtureOutput(show, patch, active, fixture, time, grandMaster, beat);
    const { channels, output } = resolved;
    frames.get(fixture.universe)!.set(encodeChannels(channels, output), fixture.address - 1);
  }
  return frames;
}

// How each Fixture in the patch looks at `time`, by Fixture id, resolved like
// `resolveFrames`.
export function resolveLights(
  show: Show,
  patch: VenuePatch,
  active: ActiveScenes,
  time: number,
  grandMaster = 1,
  beat = 0,
): Record<string, FixtureLight> {
  return Object.fromEntries(
    patch.fixtures.map((fixture) => {
      const resolved = fixtureOutput(show, patch, active, fixture, time, grandMaster, beat);
      const { channels, output } = resolved;
      return [fixture.id, fixtureLight(channels, output)];
    }),
  );
}

// How a Fixture set to `output` looks in the preview.
function fixtureLight(channels: Channel[], output: FixtureOutput): FixtureLight {
  const { red, green, blue } = shownColour(channels, output);
  return { intensity: output.intensity, red, green, blue, ...(output.aim && { aim: output.aim }) };
}

// What a Fixture is set to once the Layers are combined, and the channels of
// its mode. A movement Effect turns a moving Fixture from its aim.
function fixtureOutput(
  show: Show,
  patch: VenuePatch,
  active: ActiveScenes,
  fixture: PatchedFixture,
  time: number,
  grandMaster: number,
  beat: number,
): { channels: Channel[]; output: FixtureOutput } {
  let intensity = 0;
  let colour: ColourLevels | undefined;
  let direction: Direction | undefined;
  let turn: Turn | undefined;
  const entries = byChange(show, active);
  for (const entry of entries) {
    const look = layerLook(show, patch, fixture, entry, time, beat);
    intensity = Math.max(intensity, look.intensity ?? 0);
    colour = look.colour ?? colour;
    direction = look.direction ?? direction;
    turn = combinedTurn(turn, look);
  }
  colour ??= show.defaultColour ? colourLevels(show.defaultColour) : WHITE;
  const { channels } = fixtureMode(patch, fixture);
  const output = levelOutput(channels, intensity * grandMaster, colour);
  if (isMovingFixture(patch, fixture)) {
    output.direction = direction ?? show.defaultDirection ?? DEFAULT_DIRECTION;
    output.aim = fixtureAim(show, patch, fixture, channels, output.direction, entries, time, turn);
  }
  return { channels, output };
}

// A Fixture set to `intensity` and `colour`, on the channels of its mode.
function levelOutput(channels: Channel[], intensity: number, colour: ColourLevels): FixtureOutput {
  const capabilities = channels.flatMap((channel) =>
    channel.kind === 'control' ? channel.ranges.map((r) => r.capability) : [],
  );
  const hasDimmer = capabilities.some((c) => c.type === 'intensity');
  const emitters = new Set(capabilities.flatMap((c) => (c.type === 'emitter' ? [c.emitter] : [])));
  return {
    intensity,
    colour,
    emitters,
    mix: mixesColour(emitters) ? emitterMix(colour, emitters) : fullMix(emitters),
    emitterScale: hasDimmer ? 1 : intensity,
  };
}

// The Focus Check over `frames`: every moving Fixture in the patch aimed at
// `direction`, open in white at `intensity` (0–1). Other Fixtures keep what
// `frames` has. Returns new frames; `frames` is not changed.
export function focusCheckFrames(
  patch: VenuePatch,
  frames: Map<number, Uint8Array>,
  direction: Direction,
  intensity: number,
): Map<number, Uint8Array> {
  const focused = new Map([...frames].map(([number, frame]) => [number, frame.slice()]));
  for (const fixture of patch.fixtures) {
    const focus = focusCheckOutput(patch, fixture, direction, intensity);
    if (!focus) continue;
    let frame = focused.get(fixture.universe);
    if (!frame) focused.set(fixture.universe, (frame = new Uint8Array(DMX_CHANNELS)));
    frame.set(encodeChannels(focus.channels, focus.output), fixture.address - 1);
  }
  return focused;
}

// The Focus Check over `lights`, as `focusCheckFrames` over frames.
export function focusCheckLights(
  patch: VenuePatch,
  lights: Record<string, FixtureLight>,
  direction: Direction,
  intensity: number,
): Record<string, FixtureLight> {
  const focused = { ...lights };
  for (const fixture of patch.fixtures) {
    const focus = focusCheckOutput(patch, fixture, direction, intensity);
    if (focus) focused[fixture.id] = fixtureLight(focus.channels, focus.output);
  }
  return focused;
}

// What the Focus Check sets a Fixture to; undefined unless it moves.
function focusCheckOutput(
  patch: VenuePatch,
  fixture: PatchedFixture,
  direction: Direction,
  intensity: number,
): { channels: Channel[]; output: FixtureOutput } | undefined {
  if (!isMovingFixture(patch, fixture)) return undefined;
  const { channels } = fixtureMode(patch, fixture);
  const output = levelOutput(channels, intensity, WHITE);
  const aim = aimAt({
    position: fixture,
    mounting: fixtureMounting(fixture),
    channels,
    stage: patch.stage,
    direction,
  });
  if (aim) output.aim = { pan: aim.pan, tilt: aim.tilt };
  return { channels, output };
}

// A moving Fixture's pan and tilt at `time`, aimed at `direction` and turned
// by `turn`. The activation that last changed its Direction times the move:
// the aim moves from the one shown then, over that Scene's fade-in, in
// degrees, to the pan nearest the one shown then. A Fixture dark then snaps.
// With no such activation, the pan is the one nearest the pan shown at the
// last activation, or the centre of its range.
function fixtureAim(
  show: Show,
  patch: VenuePatch,
  fixture: PatchedFixture,
  channels: Channel[],
  direction: Direction,
  entries: ActiveScene[],
  time: number,
  turn: Turn | undefined,
): AimAngles | undefined {
  const shownBy = (entry: ActiveScene) => entry.shown?.[fixture.id];
  const movedBy = entries.findLast((entry) => {
    const shown = shownBy(entry);
    return shown !== undefined && shown.direction !== direction;
  });
  const latest = movedBy ?? entries.at(-1);
  const shown = latest && shownBy(latest);
  const mounting = fixtureMounting(fixture);
  const aimed = aimAt({
    position: fixture,
    mounting,
    channels,
    stage: patch.stage,
    direction,
    ...(shown?.pan !== undefined ? { currentPan: shown.pan } : {}),
  });
  if (!aimed) return undefined;
  const aim = turnAim(channels, mounting, aimed, turn ?? STILL);
  if (!movedBy || !shown || shown.dark) return aim;
  const p = progress(show, movedBy.scene, movedBy.since, time);
  const move = (from?: number, to?: number) =>
    from === undefined || to === undefined ? to : lerp(from, to, p);
  return { pan: move(shown.pan, aim.pan), tilt: move(shown.tilt, aim.tilt) };
}

// The colour a Fixture shows at full: the colour-wheel slot picked, the
// colour mixed, or the colour of its fixed emitters. White when it has none of
// these.
function shownColour(channels: Channel[], { colour, emitters }: FixtureOutput): ColourLevels {
  const slots = channels.flatMap((channel) =>
    channel.kind === 'control'
      ? channel.ranges.filter((r) => r.capability.type === 'wheelSlot')
      : [],
  );
  if (slots.length > 0) return slotLevels(nearestSlot(slots, colour));
  if (mixesColour(emitters)) return colour;
  if (emitters.size === 0) return WHITE;
  const levels = [...emitters].map((e) => EMITTER_LEVELS[e]);
  const average = (pick: (l: ColourLevels) => number) =>
    levels.reduce((sum, l) => sum + pick(l), 0) / levels.length;
  return rgbLevels(
    average((l) => l.red),
    average((l) => l.green),
    average((l) => l.blue),
  );
}

// The active Scenes, the one changed least recently first, so later ones
// take precedence. Layers changed at the same time go in Layer order.
function byChange(show: Show, active: ActiveScenes): ActiveScene[] {
  return show.layers.flatMap((layer) => active[layer.id] ?? []).sort((a, b) => a.since - b.since);
}

// What one Scene sets on a Fixture. An absent attribute is left to other
// Scenes. `turn` is a moving Fixture's turn by a movement Effect. While a
// Layer crossfades, `turnFade` holds its turn instead.
interface Look {
  intensity?: number;
  colour?: ColourLevels;
  direction?: Direction;
  turn?: Turn;
  turnFade?: TurnFade;
}

// A turn fading `p` (0–1) of the way between two looks' turns. An absent one
// is the turn the Layers below give.
interface TurnFade {
  from?: Turn;
  to?: Turn;
  p: number;
}

const STILL: Turn = { pan: 0, tilt: 0 };

// The turn once a look is combined over `below`, the turn the Layers below
// give.
function combinedTurn(below: Turn | undefined, { turn, turnFade }: Look): Turn | undefined {
  if (!turnFade) return turn ?? below;
  const { from = below ?? STILL, to = below ?? STILL, p } = turnFade;
  return { pan: lerp(from.pan, to.pan, p), tilt: lerp(from.tilt, to.tilt, p) };
}

// What a Layer sets on a Fixture at `time` and `beat`. While crossfading,
// intensity fades between the two looks, an absent one counting as 0; colour
// fades between them when both set it, or else holds the one that does. The
// Direction is the new look's at once; `fixtureAim` times the move. A
// movement Effect's turn fades from the one before, or the one below, so its
// size fades in with the Scene. Both looks' Effects keep running to `beat`.
function layerLook(
  show: Show,
  patch: VenuePatch,
  fixture: PatchedFixture,
  { scene: id, since, from }: ActiveScene,
  time: number,
  beat: number,
): Look {
  const scene = findScene(show, id);
  const target = scene ? sceneLook(patch, fixture, scene, beat) : {};
  const p = progress(show, id, since, time);
  if (p === 1) return target;
  const before = from ? layerLook(show, patch, fixture, from, since, beat) : {};
  const look: Look = {};
  if (before.intensity !== undefined || target.intensity !== undefined) {
    look.intensity = lerp(before.intensity ?? 0, target.intensity ?? 0, p);
  }
  const colour =
    before.colour && target.colour
      ? blend(before.colour, target.colour, p)
      : (target.colour ?? before.colour);
  if (colour) look.colour = colour;
  if (target.direction) look.direction = target.direction;
  // A fade underway before is taken as over the Fixture held still.
  const beforeTurn = before.turnFade ? combinedTurn(STILL, before) : before.turn;
  if (beforeTurn || target.turn) {
    look.turnFade = {
      p,
      ...(beforeTurn && { from: beforeTurn }),
      ...(target.turn && { to: target.turn }),
    };
  }
  return look;
}

// What a Scene sets on a Fixture, its movement Effect at `beat`.
function sceneLook(patch: VenuePatch, fixture: PatchedFixture, scene: Scene, beat: number): Look {
  const look: Look = {};
  const moving = isMovingFixture(patch, fixture);
  for (const rule of scene.rules) {
    if (!ruleTargets(patch, fixture, rule)) continue;
    if (rule.intensity !== undefined) look.intensity = rule.intensity;
    if (rule.colour !== undefined) look.colour = colourLevels(rule.colour);
    if (rule.direction !== undefined) look.direction = rule.direction;
    if (rule.effect !== undefined && moving) {
      const targeted = patch.fixtures.filter(
        (other) => isMovingFixture(patch, other) && ruleTargets(patch, other, rule),
      );
      const delay = spreadDelay(rule.effect.spread, fixture, targeted);
      look.turn = effectTurn(rule.effect, beat, delay, fixture.id);
    }
  }
  return look;
}

function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p;
}

function blend(a: ColourLevels, b: ColourLevels, p: number): ColourLevels {
  return {
    red: lerp(a.red, b.red, p),
    green: lerp(a.green, b.green, p),
    blue: lerp(a.blue, b.blue, p),
    uv: lerp(a.uv, b.uv, p),
  };
}

// A colour as red, green, blue and ultraviolet levels, each 0–1. Red, green
// and blue stand in for ultraviolet on Fixtures without a UV emitter.
interface ColourLevels {
  red: number;
  green: number;
  blue: number;
  uv: number;
}

const rgbLevels = (red: number, green: number, blue: number): ColourLevels => ({
  red,
  green,
  blue,
  uv: 0,
});

const WHITE = rgbLevels(1, 1, 1);

const SWATCH_LEVELS: Record<Swatch, ColourLevels> = {
  Red: rgbLevels(1, 0, 0),
  Orange: rgbLevels(1, 0.5, 0),
  Amber: rgbLevels(1, 0.75, 0),
  Yellow: rgbLevels(1, 1, 0),
  Green: rgbLevels(0, 1, 0),
  Cyan: rgbLevels(0, 1, 1),
  Blue: rgbLevels(0, 0, 1),
  Lavender: rgbLevels(0.6, 0.4, 1),
  Magenta: rgbLevels(1, 0, 1),
  Pink: rgbLevels(1, 0.4, 0.7),
  White: WHITE,
  'Warm White': rgbLevels(1, 0.85, 0.6),
  UV: { red: 0.3, green: 0, blue: 1, uv: 1 },
};

function colourLevels(colour: Colour): ColourLevels {
  return 'swatch' in colour ? SWATCH_LEVELS[colour.swatch] : hsv(colour.hue, colour.saturation);
}

// Hue and saturation at full value.
function hsv(hue: number, saturation: number): ColourLevels {
  const channel = (n: number) => {
    const k = (n + hue / 60) % 6;
    return 1 - saturation * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return rgbLevels(channel(5), channel(3), channel(1));
}

type EmitterMix = Partial<Record<Emitter, number>>;

// The colour of an amber emitter.
const AMBER = SWATCH_LEVELS.Amber;

// The colour each kind of emitter gives out.
const EMITTER_LEVELS: Record<Emitter, ColourLevels> = {
  red: SWATCH_LEVELS.Red,
  green: SWATCH_LEVELS.Green,
  blue: SWATCH_LEVELS.Blue,
  white: WHITE,
  warmWhite: SWATCH_LEVELS['Warm White'],
  coldWhite: rgbLevels(0.85, 0.9, 1),
  amber: AMBER,
  lime: rgbLevels(0.75, 1, 0),
  cyan: SWATCH_LEVELS.Cyan,
  magenta: SWATCH_LEVELS.Magenta,
  yellow: SWATCH_LEVELS.Yellow,
  indigo: rgbLevels(0.3, 0, 1),
  uv: SWATCH_LEVELS.UV,
};

// The emitter levels that make `colour` on a Fixture with `emitters`. A UV
// emitter takes the ultraviolet. White, then amber, take as much of the rest
// as they can; red, green and blue mix what is left.
function emitterMix(colour: ColourLevels, emitters: Set<Emitter>): EmitterMix {
  let { red, green, blue } = colour;
  const mix: EmitterMix = {};
  if (emitters.has('uv')) {
    mix.uv = colour.uv;
    red *= 1 - colour.uv;
    green *= 1 - colour.uv;
    blue *= 1 - colour.uv;
  }
  if (emitters.has('white')) {
    mix.white = Math.min(red, green, blue);
    red -= mix.white;
    green -= mix.white;
    blue -= mix.white;
  }
  if (emitters.has('amber')) {
    mix.amber = Math.min(red / AMBER.red, green / AMBER.green);
    red -= mix.amber * AMBER.red;
    green -= mix.amber * AMBER.green;
  }
  return { ...mix, red, green, blue };
}

// Whether a Fixture's emitters can make colours. Without red, green and blue,
// colour is ignored and the emitters carry intensity only.
function mixesColour(emitters: Set<Emitter>): boolean {
  return emitters.has('red') && emitters.has('green') && emitters.has('blue');
}

function fullMix(emitters: Set<Emitter>): EmitterMix {
  return Object.fromEntries([...emitters].map((e) => [e, 1]));
}

// What a Fixture is set to once the Layers are combined.
interface FixtureOutput {
  intensity: number;
  // The Show's default colour when no Rule sets one.
  colour: ColourLevels;
  emitters: Set<Emitter>;
  mix: EmitterMix;
  // Scales the emitters; carries intensity on Fixtures without a dimmer.
  emitterScale: number;
  // A moving Fixture's Direction, and its pan and tilt.
  direction?: Direction;
  aim?: AimAngles;
}

// The DMX values of a Fixture's channels, offset 0 first. A control channel
// with fine channels is set with 16-bit precision.
function encodeChannels(channels: Channel[], output: FixtureOutput): number[] {
  const fineNames = new Set(channels.flatMap((c) => (c.kind === 'fine' ? [c.of] : [])));
  const values = new Map<string, number>();
  for (const channel of channels) {
    if (channel.kind !== 'control') continue;
    const point = channelPoint(channel, output);
    if (point) values.set(channel.name, toDmx(point, fineNames.has(channel.name)));
  }
  const aim = output.aim && aimDmx(channels, output.aim);
  return channels.map((channel, offset) => {
    const aimed = aim?.get(offset);
    if (aimed !== undefined) return aimed;
    if (channel.kind === 'unused') return 0;
    if (channel.kind === 'control') {
      const value = values.get(channel.name);
      return value === undefined
        ? channel.defaultValue
        : fineNames.has(channel.name)
          ? dmxByte(value, 0)
          : value;
    }
    const value = values.get(channel.of);
    if (value === undefined) return channel.defaultValue;
    return dmxByte(value, channel.byte);
  });
}

// Where a control channel is set, or undefined to leave it at its default.
function channelPoint(
  channel: Extract<Channel, { kind: 'control' }>,
  { intensity, colour, mix, emitterScale }: FixtureOutput,
): Point | undefined {
  const { ranges } = channel;
  const slots = ranges.filter((r) => r.capability.type === 'wheelSlot');
  if (slots.length > 0) return fixed(middle(nearestSlot(slots, colour)));
  const open = ranges.find(
    (r) => r.capability.type === 'shutter' && r.capability.effect === 'open',
  );
  if (open) return fixed(middle(open));
  const dimmer = ranges.filter((r) => r.capability.type === 'intensity');
  if (dimmer.length > 0) return levelPoint(dimmer, intensity);
  const emitter = ranges.find((r) => r.capability.type === 'emitter')?.capability;
  if (emitter?.type !== 'emitter') return undefined;
  const same = ranges.filter(
    (r) => r.capability.type === 'emitter' && r.capability.emitter === emitter.emitter,
  );
  return levelPoint(same, (mix[emitter.emitter] ?? 0) * emitterScale);
}

// The point that sets `level` (0–1) on intensity or emitter `ranges`. Each
// range's `level` span says how output varies across it. The first range
// whose span holds `level` is used, or else the first range.
function levelPoint(ranges: CapabilityRange[], level: number): Point {
  const span = ({ capability }: CapabilityRange): [number, number] =>
    ((capability.type === 'intensity' || capability.type === 'emitter') && capability.level) || [
      0, 1,
    ];
  const holds = (range: CapabilityRange) => {
    const [a, b] = span(range);
    return Math.min(a, b) <= level && level <= Math.max(a, b);
  };
  const range = ranges.find(holds) ?? ranges[0]!;
  const [a, b] = span(range);
  const t = a === b ? 0 : clamp((level - a) / (b - a));
  return { from: range.from, to: range.to, t };
}

function middle({ from, to }: CapabilityRange): number {
  return Math.floor((from + to) / 2);
}

// The wheel slot range whose colour is closest to `colour`.
function nearestSlot(slots: CapabilityRange[], colour: ColourLevels): CapabilityRange {
  const distance = (range: CapabilityRange) => {
    const slot = slotLevels(range);
    return (
      (slot.red - colour.red) ** 2 +
      (slot.green - colour.green) ** 2 +
      (slot.blue - colour.blue) ** 2
    );
  };
  return slots.reduce((best, range) => (distance(range) < distance(best) ? range : best));
}

// A wheel slot range's colour; white for any other range.
function slotLevels({ capability }: CapabilityRange): ColourLevels {
  return capability.type === 'wheelSlot' ? hexLevels(capability.slot.colour) : WHITE;
}

// '#rrggbb' as ColourLevels.
function hexLevels(hex: string): ColourLevels {
  const byte = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
  return rgbLevels(byte(1), byte(3), byte(5));
}
