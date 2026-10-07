// Scene resolution: the active Scenes of a Show, resolved against a Venue
// Patch, as one DMX frame per Universe. Pure, so it is testable without
// hardware.
import type { CapabilityRange, Channel, Emitter } from '../shared/fixture-profile';
import type { Colour, Rule, Scene, Show, Swatch } from '../shared/show';
import {
  DMX_CHANNELS,
  fixtureMode,
  fixtureRole,
  fixtureZone,
  sameZone,
  type PatchedFixture,
  type VenuePatch,
} from '../shared/venue-patch';

// The Scene a Layer shows, since `since` (seconds). Until the Scene's fade-in
// is over, the Layer crossfades from `from`, what it showed before; a Layer
// that was clear has no `from`.
export interface ActiveScene {
  scene: string;
  since: number;
  from?: ActiveScene;
}

// Keyed by Layer id. A Layer without an entry is clear.
export type ActiveScenes = Record<string, ActiveScene>;

// Activates a Scene at `time`, replacing the active Scene in its Layer.
export function activate(
  active: ActiveScenes,
  show: Show,
  sceneId: string,
  time: number,
): ActiveScenes {
  const scene = findScene(show, sceneId);
  if (!scene) return active;
  const from = active[scene.layer];
  const entry: ActiveScene = { scene: sceneId, since: time };
  // A finished fade no longer needs what it faded from.
  if (from) entry.from = fading(show, from, time) ? from : { scene: from.scene, since: from.since };
  return { ...active, [scene.layer]: entry };
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

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

// One frame per Universe in the patch, channel 1 first, at `time` (seconds).
// The Grand Master (0–1) scales intensity after the Layers are combined.
export function resolveFrames(
  show: Show,
  patch: VenuePatch,
  active: ActiveScenes,
  time: number,
  grandMaster = 1,
): Map<number, Uint8Array> {
  const frames = new Map(patch.universes.map((u) => [u.number, new Uint8Array(DMX_CHANNELS)]));
  for (const fixture of patch.fixtures) {
    let intensity = 0;
    let colour: ColourLevels | undefined;
    for (const entry of byChange(show, active)) {
      const look = layerLook(show, patch, fixture, entry, time);
      intensity = Math.max(intensity, look.intensity ?? 0);
      colour = look.colour ?? colour;
    }
    intensity *= grandMaster;
    const frame = frames.get(fixture.universe)!;
    const { channels } = fixtureMode(patch, fixture);
    const capabilities = channels.flatMap((channel) =>
      channel.kind === 'control' ? channel.ranges.map((r) => r.capability) : [],
    );
    const hasDimmer = capabilities.some((c) => c.type === 'intensity');
    const emitters = new Set(
      capabilities.flatMap((c) => (c.type === 'emitter' ? [c.emitter] : [])),
    );
    const output: FixtureOutput = {
      intensity,
      colour,
      mix: mixesColour(emitters) ? colour && emitterMix(colour, emitters) : fullMix(emitters),
      emitterScale: hasDimmer ? 1 : intensity,
    };
    frame.set(encodeChannels(channels, output), fixture.address - 1);
  }
  return frames;
}

// The active Scenes, the one changed least recently first, so later ones
// take precedence. Layers changed at the same time go in Layer order.
function byChange(show: Show, active: ActiveScenes): ActiveScene[] {
  return show.layers.flatMap((layer) => active[layer.id] ?? []).sort((a, b) => a.since - b.since);
}

function ruleTargets(patch: VenuePatch, fixture: PatchedFixture, { target }: Rule): boolean {
  const zone = fixtureZone(patch, fixture);
  const role = fixtureRole(patch, fixture);
  const inZone = !target.zones || target.zones.some((z) => sameZone(z, zone));
  return inZone && (!target.roles || target.roles.includes(role));
}

// What one Scene sets on a Fixture. An absent attribute is left to other
// Scenes.
interface Look {
  intensity?: number;
  colour?: ColourLevels;
}

// What a Layer sets on a Fixture at `time`. While crossfading, intensity
// fades between the two looks, an absent one counting as 0; colour fades
// between them when both set it, or else holds the one that does.
function layerLook(
  show: Show,
  patch: VenuePatch,
  fixture: PatchedFixture,
  { scene: id, since, from }: ActiveScene,
  time: number,
): Look {
  const scene = findScene(show, id);
  const target = scene ? sceneLook(patch, fixture, scene) : {};
  const p = progress(show, id, since, time);
  if (p === 1) return target;
  const before = from ? layerLook(show, patch, fixture, from, since) : {};
  const look: Look = {};
  if (before.intensity !== undefined || target.intensity !== undefined) {
    look.intensity = lerp(before.intensity ?? 0, target.intensity ?? 0, p);
  }
  const colour =
    before.colour && target.colour
      ? blend(before.colour, target.colour, p)
      : (target.colour ?? before.colour);
  if (colour) look.colour = colour;
  return look;
}

function sceneLook(patch: VenuePatch, fixture: PatchedFixture, scene: Scene): Look {
  const look: Look = {};
  for (const rule of scene.rules) {
    if (!ruleTargets(patch, fixture, rule)) continue;
    if (rule.intensity !== undefined) look.intensity = rule.intensity;
    if (rule.colour !== undefined) look.colour = colourLevels(rule.colour);
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
  White: rgbLevels(1, 1, 1),
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
  // Undefined when no Rule sets colour.
  colour: ColourLevels | undefined;
  mix: EmitterMix | undefined;
  // Scales the emitters; carries intensity on Fixtures without a dimmer.
  emitterScale: number;
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
  return channels.map((channel) => {
    if (channel.kind === 'unused') return 0;
    if (channel.kind === 'control') {
      const value = values.get(channel.name);
      return value === undefined
        ? channel.defaultValue
        : fineNames.has(channel.name)
          ? value >> 8
          : value;
    }
    const value = values.get(channel.of);
    if (value === undefined) return channel.defaultValue;
    return channel.byte === 1 ? value & 0xff : 0;
  });
}

// A point `t` (0–1) of the way across the DMX values `from`–`to`.
interface Point {
  from: number;
  to: number;
  t: number;
}

const fixed = (value: number): Point => ({ from: value, to: value, t: 0 });

// The DMX value of a point: 8-bit, or 16-bit when the channel has a fine
// channel, `to` then spanning its whole fine range.
function toDmx({ from, to, t }: Point, fine: boolean): number {
  if (!fine) return Math.round(from + (to - from) * t);
  return Math.round(from * 256 + (to * 256 + 255 - from * 256) * t);
}

// Where a control channel is set, or undefined to leave it at its default.
function channelPoint(
  channel: Extract<Channel, { kind: 'control' }>,
  { intensity, colour, mix, emitterScale }: FixtureOutput,
): Point | undefined {
  const { ranges } = channel;
  const slots = ranges.filter((r) => r.capability.type === 'wheelSlot');
  if (slots.length > 0) return colour && fixed(nearestSlot(slots, colour));
  const open = ranges.find(
    (r) => r.capability.type === 'shutter' && r.capability.effect === 'open',
  );
  if (open) return fixed(middle(open));
  const dimmer = ranges.filter((r) => r.capability.type === 'intensity');
  if (dimmer.length > 0) return levelPoint(dimmer, intensity);
  const emitter = ranges.find((r) => r.capability.type === 'emitter')?.capability;
  if (emitter?.type !== 'emitter') return undefined;
  if (!mix) return { from: 0, to: channel.defaultValue, t: emitterScale };
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

// The middle of the wheel slot range whose colour is closest to `colour`.
function nearestSlot(slots: CapabilityRange[], colour: ColourLevels): number {
  const distance = ({ capability }: CapabilityRange) => {
    if (capability.type !== 'wheelSlot') return Infinity;
    const slot = hexLevels(capability.slot.colour);
    return (
      (slot.red - colour.red) ** 2 +
      (slot.green - colour.green) ** 2 +
      (slot.blue - colour.blue) ** 2
    );
  };
  return middle(slots.reduce((best, range) => (distance(range) < distance(best) ? range : best)));
}

// '#rrggbb' as ColourLevels.
function hexLevels(hex: string): ColourLevels {
  const byte = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
  return rgbLevels(byte(1), byte(3), byte(5));
}
