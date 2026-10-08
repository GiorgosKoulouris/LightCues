import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { FixtureLight } from '../../../shared/protocol';
import { emptyPatch, type PatchedFixture, type VenuePatch } from '../../../shared/venue-patch';
import { installFakeEngine, type FakeEngine } from '../test-engine';
import { Preview } from './Preview';

// Hung 6 m up on Stage Left, over the middle of an 8 m deep stage.
const mover: PatchedFixture = {
  ...{ id: 'm1', name: 'Mover 1', profileId: 'acme/mover', mode: '7ch' },
  ...{ universe: 1, address: 1, x: 3, y: 4, height: 6 },
};
const patch: VenuePatch = { ...emptyPatch({ width: 10, depth: 8 }), fixtures: [mover] };

const red = { red: 1, green: 0, blue: 0 };

let engine: FakeEngine;

beforeEach(() => {
  engine = installFakeEngine();
});

function show(light: FixtureLight) {
  render(<Preview patch={patch} />);
  engine.emit({ type: 'preview', lights: { m1: light } });
}

const beam = () => screen.queryByTestId('beam-m1');

describe('Preview', () => {
  it("draws a mover's beam on the stage plan to where it lands, in its colour", () => {
    // Tilted 45° toward the audience from 6 m up: lands 6 m downstage.
    show({ intensity: 0.5, ...red, aim: { pan: 0, tilt: 45 } });

    // SVG y is -stage y.
    const line = beam()!;
    expect(Number(line.getAttribute('x1'))).toBeCloseTo(3);
    expect(Number(line.getAttribute('y1'))).toBeCloseTo(-4);
    expect(Number(line.getAttribute('x2'))).toBeCloseTo(3);
    expect(Number(line.getAttribute('y2'))).toBeCloseTo(2);
    expect(line).toHaveAttribute('stroke', 'rgb(255 0 0)');
    expect(line).toHaveAttribute('stroke-opacity', '0.5');
  });

  it('shows the audience plane, and a level beam reaching it', () => {
    show({ intensity: 1, ...red, aim: { pan: 0, tilt: 90 } });

    // The plane is 5 m in front of the 8 m deep stage: SVG y 13.
    expect(Number(beam()!.getAttribute('y2'))).toBeCloseTo(13);
    const [, top, , height] = screen
      .getByRole('img', { name: 'Top-down preview' })
      .getAttribute('viewBox')!
      .split(' ')
      .map(Number);
    expect(top! + height!).toBeGreaterThan(13);
    expect(screen.getByTestId('audience-plane')).toHaveAttribute('y1', '13');
  });

  it('draws no beam at intensity 0, or for a Fixture without an aim', () => {
    show({ intensity: 0, ...red, aim: { pan: 0, tilt: 45 } });
    expect(beam()).toBeNull();

    engine.emit({ type: 'preview', lights: { m1: { intensity: 1, ...red } } });
    expect(beam()).toBeNull();
  });
});
