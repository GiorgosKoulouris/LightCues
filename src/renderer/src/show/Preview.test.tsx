import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FixtureLight } from '../../../shared/protocol';
import { emptyPatch, type PatchedFixture, type VenuePatch } from '../../../shared/venue-patch';
import { installFakeEngine, type FakeEngine } from '../test-engine';
import { FIXTURE_MARKER_RADIUS } from '../venue/pixelScale';
import { Preview } from './Preview';

// Hung 3 m up on Stage Left, over the middle of an 8 m deep stage.
const mover: PatchedFixture = {
  ...{ id: 'm1', name: 'Mover 1', profileId: 'acme/mover', mode: '7ch' },
  ...{ universe: 1, address: 1, x: 3, y: 4, height: 3 },
};
const patch: VenuePatch = { ...emptyPatch({ width: 10, depth: 8 }), fixtures: [mover] };

const red = { red: 1, green: 0, blue: 0 };

let engine: FakeEngine;

beforeEach(() => {
  engine = installFakeEngine();
});

afterEach(() => vi.restoreAllMocks());

function show(light: FixtureLight) {
  render(<Preview patch={patch} />);
  engine.emit({ type: 'preview', lights: { m1: light } });
}

const beam = () => screen.queryByTestId('beam-m1');

describe('Preview', () => {
  it("draws a mover's beam on the stage plan to where it lands, in its colour", () => {
    // Tilted 45° toward the audience from 3 m up: lands 3 m downstage.
    show({ intensity: 0.5, ...red, aim: { pan: 0, tilt: 45 } });

    // SVG y is -stage y.
    const line = beam()!;
    expect(Number(line.getAttribute('x1'))).toBeCloseTo(3);
    expect(Number(line.getAttribute('y1'))).toBeCloseTo(-4);
    expect(Number(line.getAttribute('x2'))).toBeCloseTo(3);
    expect(Number(line.getAttribute('y2'))).toBeCloseTo(-1);
    expect(line).toHaveAttribute('stroke', 'rgb(255 0 0)');
    expect(line).toHaveAttribute('stroke-opacity', '0.5');
    expect(screen.queryByTestId('beam-arrow-m1')).toBeNull();
  });

  it('cuts a beam that leaves the view at its edge, with an arrow', () => {
    // Level, toward the audience: it would land on the audience plane.
    show({ intensity: 1, ...red, aim: { pan: 0, tilt: 90 } });

    // The view ends at the 1 m Front row's edge, SVG y 1. The line stops
    // under the 0.4 m arrow, whose tip is on the edge.
    expect(Number(beam()!.getAttribute('y2'))).toBeCloseTo(0.6);
    const arrow = screen.getByTestId('beam-arrow-m1');
    expect(arrow.getAttribute('points')!.split(' ')[0]).toBe('3,1');
    expect(arrow).toHaveAttribute('fill', 'rgb(255 0 0)');
  });

  it('draws no beam at intensity 0, or for a Fixture without an aim', () => {
    show({ intensity: 0, ...red, aim: { pan: 0, tilt: 45 } });
    expect(beam()).toBeNull();

    engine.emit({ type: 'preview', lights: { m1: { intensity: 1, ...red } } });
    expect(beam()).toBeNull();
  });

  it('draws Fixture markers the same size on screen as the stage plan', () => {
    // jsdom lays nothing out. 680 px wide less the label room is 600 px. The
    // 10 m wide stage shows 10 m wide top-down, 12 m (1 m margins) in the
    // front elevation.
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ width: 680, height: 0 }),
    );
    show({ intensity: 1, ...red });

    for (const [name, pxPerMetre] of [
      ['Top-down preview', 60],
      ['Front elevation preview', 50],
    ] as const) {
      const marker = screen.getByRole('img', { name }).querySelector('[transform*=scale] circle')!;
      const scale = /scale\(([^)]+)\)/.exec(marker.parentElement!.getAttribute('transform')!)![1];
      expect(Number(marker.getAttribute('r')) * Number(scale) * pxPerMetre).toBeCloseTo(
        FIXTURE_MARKER_RADIUS,
      );
    }
  });
});
