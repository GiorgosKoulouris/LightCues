import { describe, expect, it } from 'vitest';
import type { Capability, Channel } from './fixture-profile';
import type { Direction } from './show';
import { DEFAULT_MOUNTING, type Mounting, type StagePosition } from './venue-patch';
import { aimAt, aimDmx, type Aim } from './aim';

const stage = { width: 10, depth: 8 };

function control(name: string, capability: Capability): Channel {
  return { kind: 'control', name, defaultValue: 0, ranges: [{ from: 0, to: 255, capability }] };
}

const fine = (of: string): Channel => ({
  kind: 'fine',
  name: `${of} fine`,
  of,
  byte: 1,
  defaultValue: 0,
});

const pan = control('Pan', { type: 'pan', degrees: [0, 540] });
const tilt = control('Tilt', { type: 'tilt', degrees: [-135, 135] });
const dimmer = control('Dimmer', { type: 'intensity' });
const spot = [dimmer, pan, tilt];

// Over the middle of the stage, 6 m up.
const rigged: StagePosition = { x: 0, y: 4, height: 6 };

function aim(
  direction: Direction,
  {
    position = rigged,
    mounting = {},
    channels = spot,
    currentPan,
  }: {
    position?: StagePosition;
    mounting?: Partial<Mounting>;
    channels?: Channel[];
    currentPan?: number;
  } = {},
): Aim {
  const result = aimAt({
    position,
    mounting: { ...DEFAULT_MOUNTING, ...mounting },
    channels,
    stage,
    direction,
    currentPan,
  });
  if (!result) throw new Error('Not a moving Fixture');
  return result;
}

const degrees = (radians: number) => (radians * 180) / Math.PI;

// The tilt from the yoke axis to a point `across` away and `along` the axis.
const tiltTo = (across: number, along: number) => degrees(Math.atan2(across, along));

// The audience plane is 5 m in front of the stage, at head height.
const AUDIENCE_Y = -(stage.depth + 5);
const HEAD = 1.7;

function expectAim(actual: Aim, pan: number, tilt: number) {
  expect(actual.pan).toBeCloseTo(pan, 6);
  expect(actual.tilt).toBeCloseTo(tilt, 6);
}

describe('aimAt', () => {
  it('is undefined for a Fixture without pan or tilt', () => {
    expect(
      aimAt({
        position: rigged,
        mounting: DEFAULT_MOUNTING,
        channels: [dimmer],
        stage,
        direction: 'Down',
      }),
    ).toBeUndefined();
  });

  describe('a Hung Fixture, its base facing the audience', () => {
    it('aims Down along its yoke axis', () => {
      const down = aim('Down');

      expectAim(down, 0, 0);
      expect(down.approximations).toEqual([]);
    });

    it('tilts toward the front of its base for the Audience', () => {
      const audience = aim('Audience');

      expectAim(audience, 0, tiltTo(4 - AUDIENCE_Y, 6 - HEAD));
      expect(audience.approximations).toEqual([]);
    });

    it('pans toward Stage Right as pan grows, seen from above clockwise', () => {
      // Cross from Stage Left (+x) aims at the mirror point on Stage Right.
      const cross = aim('Cross', { position: { x: 3, y: 4, height: 6 } });

      expectAim(cross, 90, 45);
    });

    it('converges on centre stage at head height for Centre', () => {
      // 3 m to Stage Right and 4 m downstage of centre, 5 m above head height.
      const centre = aim('Centre', { position: { x: -3, y: 0, height: HEAD + 5 } });

      // Pan -143° at tilt 45° reaches it too; the flipped aim is nearer the
      // centre of the pan range.
      expectAim(centre, degrees(Math.atan2(3, 4)), -45);
      expect(centre.approximations).toEqual([]);
    });

    it('aims Out away from centre into the audience', () => {
      const out = aim('Out', { position: { x: 2, y: 4, height: HEAD } });

      // The Audience point pushed half the stage width further out.
      expectAim(out, degrees(Math.atan2(-(2 + 5 - 2), 4 - AUDIENCE_Y)), 90);
    });

    it('aims Out like Audience from the centre line', () => {
      expect(aim('Out')).toEqual(aim('Audience'));
    });

    it('cannot reach Up and clamps to the nearest tilt it can', () => {
      const up = aim('Up');

      expect(Math.abs(up.tilt!)).toBeCloseTo(135, 6);
      expect(up.approximations).toEqual(['outOfReach']);
    });
  });

  describe('a Standing Fixture', () => {
    const floor: StagePosition = { x: 0, y: 4, height: 0 };

    it('aims Up along its yoke axis', () => {
      const up = aim('Up', { position: floor, mounting: { mount: 'Standing' } });

      expectAim(up, 0, 0);
      expect(up.approximations).toEqual([]);
    });

    it('tilts toward the front of its base for the Audience', () => {
      const audience = aim('Audience', { position: floor, mounting: { mount: 'Standing' } });

      expectAim(audience, 0, tiltTo(4 - AUDIENCE_Y, HEAD));
    });

    it('pans toward Stage Left as pan grows', () => {
      const cross = aim('Cross', {
        position: { x: -3, y: 4, height: 6 },
        mounting: { mount: 'Standing' },
      });

      // Down and across is past 90° of tilt from straight up.
      expectAim(cross, 90, 135);
    });
  });

  describe('a rotated base', () => {
    const audienceTilt = tiltTo(4 - AUDIENCE_Y, 6 - HEAD);

    it('pans back to the audience when turned 90° clockwise, facing Stage Right', () => {
      expectAim(aim('Audience', { mounting: { rotation: 90 } }), -90, audienceTilt);
    });

    it('tilts the other way when turned 180°, facing upstage', () => {
      expectAim(aim('Audience', { mounting: { rotation: 180 } }), 0, -audienceTilt);
    });
  });

  describe('inversion and offsets', () => {
    const audienceTilt = tiltTo(4 - AUDIENCE_Y, 6 - HEAD);

    it('inverts pan and tilt', () => {
      const audience = aim('Audience', {
        mounting: { rotation: 90, panInvert: true, tiltInvert: true },
      });

      expectAim(audience, 90, -audienceTilt);
    });

    it('takes the offsets off the aim', () => {
      const audience = aim('Audience', {
        mounting: { rotation: 90, panOffset: 20, tiltOffset: 10 },
        currentPan: -100,
      });

      expectAim(audience, -110, audienceTilt - 10);
      // Without a current pan, the flipped aim is nearer the centre.
      expectAim(
        aim('Audience', { mounting: { rotation: 90, panOffset: 20, tiltOffset: 10 } }),
        70,
        -audienceTilt - 10,
      );
    });
  });

  describe('choosing between pan solutions', () => {
    it('prefers tilting toward the front of the base when both are as near', () => {
      // Pan -90 tilt 45 and pan 90 tilt -45 both reach the mirror point.
      expectAim(aim('Cross', { position: { x: -3, y: 4, height: 6 } }), -90, 45);
    });

    const audienceTilt = tiltTo(4 - AUDIENCE_Y, 6 - HEAD);

    it('picks the one nearest the current pan', () => {
      expectAim(aim('Audience', { currentPan: 170 }), 180, -audienceTilt);
      expectAim(aim('Audience', { currentPan: -200 }), -180, -audienceTilt);
      expectAim(aim('Audience', { currentPan: 40 }), 0, audienceTilt);
    });

    it('keeps the current pan where pan does not matter', () => {
      expectAim(aim('Down', { currentPan: 100 }), 100, 0);
    });
  });

  describe('Profiles without degree ranges', () => {
    const bare = [control('Pan', { type: 'pan' }), control('Tilt', { type: 'tilt' })];

    it('assumes pan 540° and tilt 270°, and reports the aim approximated', () => {
      const audience = aim('Audience', { channels: bare });

      expectAim(audience, 0, tiltTo(4 - AUDIENCE_Y, 6 - HEAD));
      expect(audience.approximations).toEqual(['assumedPanRange', 'assumedTiltRange']);
      expect(aim('Down', { channels: bare }).approximations).toEqual([
        'assumedPanRange',
        'assumedTiltRange',
      ]);
    });

    it('names only the axis without degrees', () => {
      const tiltOnly = [pan, control('Tilt', { type: 'tilt' })];

      expect(aim('Down', { channels: tiltOnly }).approximations).toEqual(['assumedTiltRange']);
    });

    it('reports an aim beyond the assumed range as out of reach too', () => {
      expect(aim('Up', { channels: bare }).approximations).toEqual([
        'assumedPanRange',
        'assumedTiltRange',
        'outOfReach',
      ]);
    });
  });

  describe('a Fixture with one axis', () => {
    it('tilts only, its pan fixed at the front of its base', () => {
      const bar = [dimmer, tilt];

      const audience = aim('Audience', { channels: bar });
      expect(audience.pan).toBeUndefined();
      expect(audience.tilt).toBeCloseTo(tiltTo(4 - AUDIENCE_Y, 6 - HEAD), 6);
      expect(audience.approximations).toEqual([]);

      // Turned to Stage Right, the bar can only tilt across the stage, so the
      // nearest it gets to the audience is straight down.
      const turned = aim('Audience', { channels: bar, mounting: { rotation: 90 } });
      expect(turned.tilt).toBeCloseTo(0, 6);
      expect(turned.approximations).toEqual(['missingAxis']);
    });

    it('is out of reach, not missing an axis, where its one axis falls short', () => {
      // Straight up needs only tilt, 180°, beyond the bar's 135°.
      const up = aim('Up', { channels: [dimmer, tilt] });

      expect(up.approximations).toEqual(['outOfReach']);
    });

    it('pans only, its tilt fixed at its offset', () => {
      const scanner = [dimmer, pan];

      const down = aim('Down', { channels: scanner });
      expect(down.tilt).toBeUndefined();
      expect(down.approximations).toEqual([]);

      // Tilted 90° by its offset, it sweeps the horizon.
      const cross = aim('Cross', {
        channels: scanner,
        position: { x: 3, y: 4, height: 6 },
        mounting: { tiltOffset: 90 },
      });
      expect(cross.pan).toBeCloseTo(90, 6);
      expect(cross.approximations).toEqual(['missingAxis']);
    });
  });

  describe('DMX values', () => {
    it('maps degrees across the channel range', () => {
      // Pan -90 is 1/3 across 0–540°; tilt 45 is 2/3 across -135–135°.
      const { dmx } = aim('Cross', { position: { x: -3, y: 4, height: 6 } });

      expect(dmx).toEqual(
        new Map([
          [1, Math.round(255 * (180 / 540))],
          [2, Math.round(255 * (180 / 270))],
        ]),
      );
    });

    it('sets 16-bit channels coarse and fine', () => {
      const channels = [pan, fine('Pan'), tilt, fine('Tilt')];
      // Pan -90 is 1/3 across 0–540°, tilt 45 is 2/3 across -135–135°.
      const { dmx } = aim('Cross', { channels, position: { x: -3, y: 4, height: 6 } });

      // 65535 / 3 = 21845 = 85 × 256 + 85.
      expect(dmx).toEqual(
        new Map([
          [0, 85],
          [1, 85],
          [2, 170],
          [3, 170],
        ]),
      );
    });

    it('follows a reversed degree range', () => {
      const reversed = [control('Tilt', { type: 'tilt', degrees: [135, -135] })];
      const { dmx } = aim('Cross', {
        channels: reversed,
        position: { x: -3, y: 4, height: 6 },
        mounting: { rotation: 90 },
      });

      // Facing Stage Right, the mirror point is 45° behind: 2/3 across 135 to -135°.
      expect(dmx).toEqual(new Map([[0, 170]]));
    });
  });
});

describe('aimDmx', () => {
  it('sets channel degrees between aims, coarse and fine', () => {
    const channels = [dimmer, pan, fine('Pan'), tilt];
    // Pan -135 is 1/4 across 0–540°; tilt 0 is the middle of -135–135°.
    // 65535 / 4 = 16384 = 64 × 256 + 0.
    expect(aimDmx(channels, { pan: -135, tilt: 0 })).toEqual(
      new Map([
        [1, 64],
        [2, 0],
        [3, 128],
      ]),
    );
  });

  it('matches the DMX of an aim, and skips axes it is not given', () => {
    const cross = aim('Cross', { position: { x: -3, y: 4, height: 6 } });

    expect(aimDmx(spot, cross)).toEqual(cross.dmx);
    expect(aimDmx(spot, { tilt: 0 })).toEqual(new Map([[2, 128]]));
  });
});
