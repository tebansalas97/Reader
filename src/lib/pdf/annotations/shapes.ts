import type { Annotation, Point, Quad } from './model';

export const UNDERLINE_POSITION = 0.04;
export const STRIKEOUT_POSITION = 0.42;
export const LINE_RATIO = 0.06;
export const MIN_LINE_THICKNESS = 0.6;

export interface Corners {
  tl: Point;
  tr: Point;
  bl: Point;
  br: Point;
}

export function cornersOf(quad: Quad): Corners {
  return {
    tl: { x: quad.x1, y: quad.y1 },
    tr: { x: quad.x2, y: quad.y2 },
    bl: { x: quad.x3, y: quad.y3 },
    br: { x: quad.x4, y: quad.y4 },
  };
}

export function quadHeight(quad: Quad): number {
  const { tl, bl } = cornersOf(quad);
  return Math.hypot(tl.x - bl.x, tl.y - bl.y);
}

function between(from: Point, to: Point, ratio: number): Point {
  return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
}

export function stripOf(quad: Quad, from: number, to: number): Point[] {
  const { tl, tr, bl, br } = cornersOf(quad);
  return [
    between(bl, tl, from),
    between(br, tr, from),
    between(br, tr, to),
    between(bl, tl, to),
  ];
}

export function lineThicknessRatio(quad: Quad): number {
  const height = quadHeight(quad);
  if (height <= 0) return LINE_RATIO;
  return Math.max(LINE_RATIO, MIN_LINE_THICKNESS / height);
}

export function polygonsOf(annotation: Annotation): Point[][] {
  const quads = (annotation.quads ?? []).filter((quad) => quadHeight(quad) > 0);
  if (quads.length === 0) return [];

  if (annotation.kind === 'highlight') return quads.map((quad) => stripOf(quad, 0, 1));
  if (annotation.kind === 'underline' || annotation.kind === 'strikeout') {
    const start = annotation.kind === 'underline' ? UNDERLINE_POSITION : STRIKEOUT_POSITION;
    return quads.map((quad) => stripOf(quad, start, start + lineThicknessRatio(quad)));
  }
  return [];
}
