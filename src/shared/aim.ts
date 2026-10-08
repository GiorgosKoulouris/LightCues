// Aims a moving Fixture at a Direction: pan/tilt computed from its stage
// position, Mounting and its Profile's degree ranges (ADR 0007). Pure.
//
// In a Fixture's own frame, tilt 0 is the beam along the yoke axis: straight
// down when Hung, straight up when Standing. Pan 0 has the beam tilted toward
// the front of the base. Positive pan turns right-handed about the yoke axis
// (from the base toward the head): clockwise seen from above when Hung,
// anticlockwise when Standing. Base rotation turns the front clockwise seen
// from above, so 90° faces Stage Right.
import type { CapabilityRange, Channel, Span } from './fixture-profile';
import type { Direction } from './show';
import type { Mounting, StageBounds, StagePosition } from './venue-patch';
import { dmxByte, toDmx } from './dmx-point';

// Where Audience, Centre and Out aim: head height, and how far in front of
// the downstage edge the audience plane is, beyond the stage depth. Metres.
const HEAD_HEIGHT = 1.7;
const AUDIENCE_DISTANCE = 5;

// How far a beam that lands on neither the floor nor the audience plane is
// drawn, in metres.
export const BEAM_UP_LENGTH = 3;

// The degrees assumed across a channel whose Profile gives none.
export const ASSUMED_DEGREES = { pan: 540, tilt: 270 };

// How far off, in degrees, an aim may be and still count as exact.
const TOLERANCE = 0.01;

export interface AimInput {
  position: StagePosition;
  mounting: Mounting;
  // The channels of the Fixture's mode.
  channels: Channel[];
  stage: StageBounds;
  direction: Direction;
  // Where the pan is now, as `Aim.pan`. Picks between pan solutions that
  // reach the same aim; the centre of the range when absent.
  currentPan?: number;
}

export interface Aim {
  // Degrees from the centre of each channel's range, as sent: after
  // inversion and offset. Absent for an axis the Fixture lacks.
  pan?: number;
  tilt?: number;
  // Why the aim is not exact, in `APPROXIMATIONS` order; empty when it is.
  approximations: Approximation[];
  // DMX values by channel offset in the mode, coarse and fine.
  dmx: Map<number, number>;
}

// A pan and tilt, as `Aim.pan` and `Aim.tilt`.
export type AimAngles = Pick<Aim, 'pan' | 'tilt'>;

// Why an aim is approximated: degrees assumed for an axis the Profile gives
// none for; an aim beyond an axis's range; an aim needing an axis the Fixture
// lacks. An aim needing a missing axis is not also out of reach, however far
// its other axis is clamped.
export const APPROXIMATIONS = [
  'assumedPanRange',
  'assumedTiltRange',
  'outOfReach',
  'missingAxis',
] as const;
export type Approximation = (typeof APPROXIMATIONS)[number];

// The aim for a Direction; undefined for a Fixture without pan or tilt.
export function aimAt(input: AimInput): Aim | undefined {
  const { channels, mounting } = input;
  const pan = findAxis(channels, 'pan');
  const tilt = findAxis(channels, 'tilt');
  if (!pan && !tilt) return undefined;

  const frame = fixtureFrame(mounting);
  const target = unit(targetVector(input));
  const currentPan = input.currentPan ?? 0;
  const physicalPan = (channel: number) => physicalAngle(mounting, 'pan', channel);
  const physicalTilt = (channel: number) => physicalAngle(mounting, 'tilt', channel);
  const channelPan = (physical: number) => channelAngle(mounting, 'pan', physical);
  const channelTilt = (physical: number) => channelAngle(mounting, 'tilt', physical);

  const solutions = physicalSolutions(frame, target, {
    pan: pan ? undefined : physicalPan(0),
    tilt: tilt ? undefined : physicalTilt(0),
    keptPan: physicalPan(currentPan),
  });

  // Off target before any clamping: only a missing axis does that.
  const unclamped = Math.min(
    ...solutions.map((s) => angleBetween(beamVector(frame, s.pan, s.tilt), target)),
  );

  let best: Candidate | undefined;
  for (const solution of solutions) {
    for (const panTurn of pan ? TURNS : [0]) {
      for (const tiltTurn of tilt ? TURNS : [0]) {
        const candidatePan = pan ? clampTo(pan, channelPan(solution.pan) + panTurn) : 0;
        const candidateTilt = tilt ? clampTo(tilt, channelTilt(solution.tilt) + tiltTurn) : 0;
        const beam = beamVector(frame, physicalPan(candidatePan), physicalTilt(candidateTilt));
        const candidate = {
          pan: candidatePan,
          tilt: candidateTilt,
          error: angleBetween(beam, target),
        };
        if (!best || beats(candidate, best, currentPan)) best = candidate;
      }
    }
  }
  if (!best) throw new Error('No aim solution');

  const angles = {
    ...(pan ? { pan: best.pan } : {}),
    ...(tilt ? { tilt: best.tilt } : {}),
  };
  return {
    ...angles,
    approximations: APPROXIMATIONS.filter((approximation) => {
      switch (approximation) {
        case 'assumedPanRange':
          return Boolean(pan?.assumed);
        case 'assumedTiltRange':
          return Boolean(tilt?.assumed);
        case 'outOfReach':
          return best.error > TOLERANCE && unclamped <= TOLERANCE;
        case 'missingAxis':
          return unclamped > TOLERANCE;
      }
    }),
    dmx: aimDmx(channels, angles),
  };
}

// The DMX values, by channel offset, that set a Fixture's pan and tilt to
// channel angles, as `Aim.pan` and `Aim.tilt`. An axis not given, or one the
// Fixture lacks, is left out.
export function aimDmx(channels: Channel[], { pan, tilt }: AimAngles): Map<number, number> {
  const dmx = new Map<number, number>();
  const panAxis = findAxis(channels, 'pan');
  const tiltAxis = findAxis(channels, 'tilt');
  if (panAxis && pan !== undefined) setDmx(dmx, panAxis, pan);
  if (tiltAxis && tilt !== undefined) setDmx(dmx, tiltAxis, tilt);
  return dmx;
}

// Degrees to turn pan and tilt by, physically: as the Fixture moves, before
// its Mounting's inversion.
export interface Turn {
  pan: number;
  tilt: number;
}

// Channel angles, as `Aim.pan` and `Aim.tilt`, turned by physical degrees on
// each axis, as the Mounting's inversion turns them, then clamped to each
// axis's range. An axis the Fixture lacks, or one not given, is left out.
export function turnAim(
  channels: Channel[],
  mounting: Mounting,
  angles: AimAngles,
  by: Turn,
): AimAngles {
  const turned: AimAngles = {};
  for (const axis of ['pan', 'tilt'] as const) {
    const found = findAxis(channels, axis);
    const angle = angles[axis];
    if (!found || angle === undefined) continue;
    turned[axis] = clampTo(found, angle + mountingAxis(mounting, axis).sign * by[axis]);
  }
  return turned;
}

export interface BeamInput {
  position: StagePosition;
  mounting: Mounting;
  stage: StageBounds;
  // Channel angles, as `Aim.pan` and `Aim.tilt`. An axis not given is at 0.
  angles: AimAngles;
}

// Where a beam lands: the floor, else the audience plane, whichever it meets
// first, else `BEAM_UP_LENGTH` along it.
export function beamLanding({ position, mounting, stage, angles }: BeamInput): StagePosition {
  const beam = beamVector(
    fixtureFrame(mounting),
    physicalAngle(mounting, 'pan', angles.pan ?? 0),
    physicalAngle(mounting, 'tilt', angles.tilt ?? 0),
  );
  const { x, y, height } = position;
  // How far along the beam each surface is, where it heads toward it.
  const distances = [
    beam[2] < -1e-9 ? height / -beam[2] : -1,
    beam[1] < -1e-9 ? (y - audienceY(stage)) / -beam[1] : -1,
  ].filter((d) => d >= 0);
  const distance = distances.length > 0 ? Math.min(...distances) : BEAM_UP_LENGTH;
  return {
    x: x + beam[0] * distance,
    y: y + beam[1] * distance,
    height: height + beam[2] * distance,
  };
}

// A physical angle from a channel angle: after inversion and offset.
function physicalAngle(mounting: Mounting, axis: keyof AimAngles, channel: number): number {
  const { sign, offset } = mountingAxis(mounting, axis);
  return sign * channel + offset;
}

// A channel angle from a physical angle: the inverse of `physicalAngle`.
function channelAngle(mounting: Mounting, axis: keyof AimAngles, physical: number): number {
  const { sign, offset } = mountingAxis(mounting, axis);
  return sign * (physical - offset);
}

// How a Mounting turns one axis: -1 when inverted, and its offset.
function mountingAxis(mounting: Mounting, axis: keyof AimAngles) {
  return axis === 'pan'
    ? { sign: mounting.panInvert ? -1 : 1, offset: mounting.panOffset }
    : { sign: mounting.tiltInvert ? -1 : 1, offset: mounting.tiltOffset };
}

// The y of the audience plane, where Audience and Out aim.
export function audienceY(stage: StageBounds): number {
  return -(stage.depth + AUDIENCE_DISTANCE);
}

// Channel pan and tilt, and how far off target they aim, in degrees.
interface Candidate {
  pan: number;
  tilt: number;
  error: number;
}

// Whether `a` beats `b`: clearly nearer the target, or as near with its pan
// nearer `currentPan`. On a tie, `b` stays.
function beats(a: Candidate, b: Candidate, currentPan: number): boolean {
  if (a.error < b.error - TOLERANCE) return true;
  const panDistance = (c: Candidate) => Math.abs(c.pan - currentPan);
  return a.error <= b.error + TOLERANCE && panDistance(a) < panDistance(b);
}

// Whole turns tried on each axis, so a wide range can reach an aim the long
// way round.
const TURNS = [-720, -360, 0, 360, 720];

// A pan or tilt channel: where it is in the mode and its degree range.
interface Axis {
  offset: number;
  // Its fine channels' offsets, by byte.
  fine: { offset: number; byte: number }[];
  range: CapabilityRange;
  degrees: Span;
  assumed: boolean;
}

// The first control channel with a pan (or tilt) range.
function findAxis(channels: Channel[], type: 'pan' | 'tilt'): Axis | undefined {
  for (const [offset, channel] of channels.entries()) {
    if (channel.kind !== 'control') continue;
    const range = channel.ranges.find((r) => r.capability.type === type);
    if (!range) continue;
    const { capability } = range;
    const given =
      capability.type === 'pan' || capability.type === 'tilt' ? capability.degrees : undefined;
    const half = ASSUMED_DEGREES[type] / 2;
    const fine = channels.flatMap((c, i) =>
      c.kind === 'fine' && c.of === channel.name ? [{ offset: i, byte: c.byte }] : [],
    );
    return { offset, fine, range, degrees: given ?? [-half, half], assumed: !given };
  }
  return undefined;
}

// Half an axis's degree range: channel angles run from minus this to it.
function halfRange({ degrees: [start, end] }: Axis): number {
  return Math.abs(end - start) / 2;
}

function clampTo(axis: Axis, angle: number): number {
  const half = halfRange(axis);
  return clamp(angle, -half, half);
}

// Sets an axis's channels to a channel angle: 16-bit with a fine channel.
function setDmx(dmx: Map<number, number>, axis: Axis, angle: number): void {
  const [start, end] = axis.degrees;
  const t = start === end ? 0.5 : ((start + end) / 2 + angle - start) / (end - start);
  const point = { from: axis.range.from, to: axis.range.to, t };
  if (axis.fine.length === 0) {
    dmx.set(axis.offset, toDmx(point, false));
    return;
  }
  const value = toDmx(point, true);
  dmx.set(axis.offset, dmxByte(value, 0));
  for (const { offset, byte } of axis.fine) dmx.set(offset, dmxByte(value, byte));
}

type Vector = [number, number, number];

// The yoke axis (base toward head), the front of the base, and the side that
// positive pan turns the front toward.
interface Frame {
  axis: Vector;
  front: Vector;
  side: Vector;
}

function fixtureFrame({ mount, rotation }: Mounting): Frame {
  const axis: Vector = mount === 'Standing' ? [0, 0, 1] : [0, 0, -1];
  const r = radians(rotation);
  const front: Vector = [-Math.sin(r), -Math.cos(r), 0];
  return { axis, front, side: cross(axis, front) };
}

// The beam at physical pan and tilt, in degrees.
function beamVector({ axis, front, side }: Frame, pan: number, tilt: number): Vector {
  const p = radians(pan);
  const t = radians(tilt);
  const across = add(scale(front, Math.cos(p)), scale(side, Math.sin(p)));
  return add(scale(axis, Math.cos(t)), scale(across, Math.sin(t)));
}

// From the Fixture toward where a Direction aims.
function targetVector({ position, stage, direction }: AimInput): Vector {
  const { x, y, height } = position;
  const audience = audienceY(stage);
  const toward = (tx: number, ty: number, tz: number): Vector => [tx - x, ty - y, tz - height];
  switch (direction) {
    case 'Down':
      return [0, 0, -1];
    case 'Up':
      return [0, 0, 1];
    case 'Audience':
      return toward(x, audience, HEAD_HEIGHT);
    case 'Cross':
      return toward(-x, y, 0);
    case 'Centre':
      return toward(0, stage.depth / 2, HEAD_HEIGHT);
    case 'Out':
      return toward(x + Math.sign(x) * (stage.width / 2), audience, HEAD_HEIGHT);
  }
}

// The physical pan/tilt pairs that aim along `target`, or as near as the
// Fixture's axes allow. A fixed axis (one the Fixture lacks) is given. Where
// pan does not change the aim, `keptPan` is used.
function physicalSolutions(
  { axis, front, side }: Frame,
  target: Vector,
  fixed: { pan?: number; tilt?: number; keptPan: number },
): { pan: number; tilt: number }[] {
  const along = dot(target, axis);
  const f = dot(target, front);
  const s = dot(target, side);
  const level = Math.hypot(f, s) < 1e-9;
  if (fixed.tilt !== undefined) {
    const sin = Math.sin(radians(fixed.tilt));
    const pan =
      level || Math.abs(sin) < 1e-9
        ? fixed.keptPan
        : degrees(Math.atan2(s, f)) + (sin < 0 ? 180 : 0);
    return [{ pan, tilt: fixed.tilt }];
  }
  if (fixed.pan !== undefined) {
    const p = radians(fixed.pan);
    const across = f * Math.cos(p) + s * Math.sin(p);
    return [{ pan: fixed.pan, tilt: degrees(Math.atan2(across, along)) }];
  }
  const tilt = degrees(Math.acos(clamp(along, -1, 1)));
  const pan = level ? fixed.keptPan : degrees(Math.atan2(s, f));
  return [
    { pan, tilt },
    { pan: pan + 180, tilt: -tilt },
  ];
}

function unit(v: Vector): Vector {
  const length = Math.hypot(...v);
  // Already there: aim Down rather than nowhere.
  return length < 1e-9 ? [0, 0, -1] : scale(v, 1 / length);
}

function angleBetween(a: Vector, b: Vector): number {
  return degrees(Math.acos(clamp(dot(a, b), -1, 1)));
}

const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: Vector, b: Vector): Vector => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (v: Vector, k: number): Vector => [v[0] * k, v[1] * k, v[2] * k];
const cross = (a: Vector, b: Vector): Vector => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const radians = (deg: number) => (deg * Math.PI) / 180;
const degrees = (rad: number) => (rad * 180) / Math.PI;
