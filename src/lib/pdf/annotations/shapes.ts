import { quadBounds } from './geometry';
import type { Annotation, Rect } from './model';

export const UNDERLINE_POSITION = 0.04;
export const STRIKEOUT_POSITION = 0.42;
export const MIN_LINE_THICKNESS = 0.6;

export function quadRects(annotation: Annotation): Rect[] {
  return (annotation.quads ?? []).map(quadBounds).filter((rect) => rect.width > 0);
}

export function lineRects(annotation: Annotation, position: number): Rect[] {
  return quadRects(annotation).map((rect) => ({
    x: rect.x,
    y: rect.y + rect.height * position,
    width: rect.width,
    height: Math.max(MIN_LINE_THICKNESS, rect.height * 0.06),
  }));
}

export function paintedRects(annotation: Annotation): Rect[] {
  if (annotation.kind === 'highlight') return quadRects(annotation);
  if (annotation.kind === 'underline') return lineRects(annotation, UNDERLINE_POSITION);
  if (annotation.kind === 'strikeout') return lineRects(annotation, STRIKEOUT_POSITION);
  return [];
}
