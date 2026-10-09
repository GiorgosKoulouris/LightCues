import { useLayoutEffect, useState, type RefObject } from 'react';

// Fixture markers on the stage plan and in the Preview, in screen pixels.
export const FIXTURE_MARKER_RADIUS = 7;
// Gap between a label and what it names, in screen pixels.
export const LABEL_GAP = 6;
// Kept clear around a view for its labels, in screen pixels, whatever the
// view's scale.
export const LABEL_ROOM = 40;

// Used until the SVG has been laid out.
const FALLBACK_PIXELS_PER_UNIT = 40;

interface Size {
  width: number;
  height: number;
}

// An SVG view box.
export interface View extends Size {
  x: number;
  y: number;
}

// Screen pixels per view unit of an SVG whose view, with `padding` pixels
// around it, fits inside its box, as SVG does by default. A box with no
// height has its height from its aspect ratio, so its width decides.
// Undefined for a box too small.
export function pixelScale(box: Size, view: Size, padding = 0): number | undefined {
  const byWidth = (box.width - 2 * padding) / view.width;
  if (byWidth <= 0) return undefined;
  if (box.height <= 0) return byWidth;
  const byHeight = (box.height - 2 * padding) / view.height;
  return byHeight > 0 ? Math.min(byWidth, byHeight) : undefined;
}

// Screen pixels per view unit of `svg`, kept up to date as it resizes, and
// its view box: `view` with `padding` screen pixels around it. Draw in
// pixels with `atPixels`.
export function usePixelView(
  svg: RefObject<SVGSVGElement | null>,
  view: View,
  padding = 0,
): { scale: number; viewBox: string } {
  const [box, setBox] = useState<Size>();

  useLayoutEffect(() => {
    const element = svg.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setBox({ width, height });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [svg]);

  const scale = (box && pixelScale(box, view, padding)) ?? FALLBACK_PIXELS_PER_UNIT;
  const pad = padding / scale;
  const viewBox = viewBoxOf({
    x: view.x - pad,
    y: view.y - pad,
    width: view.width + 2 * pad,
    height: view.height + 2 * pad,
  });
  return { scale, viewBox };
}

export function viewBoxOf({ x, y, width, height }: View): string {
  return `${x} ${y} ${width} ${height}`;
}

// A transform to draw in screen pixels at an SVG point, given the SVG's
// pixels per unit (see `usePixelView`).
export function atPixels(x: number, y: number, scale: number): string {
  return `translate(${x} ${y}) scale(${1 / scale})`;
}
