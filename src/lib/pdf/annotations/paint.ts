import type { PageSize } from '../document';
import { INK_WIDTH, NOTE_SIZE, SHAPE_WIDTH } from './appearance';
import { fontSizeOf, lineHeight, linesOf, measureHelvetica, textOrigin } from './freetext';
import {
  boundsOfPoints,
  quadPoints,
  strokeToScreen,
  toScreenPoint,
  toScreenRect,
} from './geometry';
import type { Annotation, Rect } from './model';
import { polygonsOf } from './shapes';
import { matrixText, screenMatrixOf } from './stamp';

export interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface PaintedLine {
  x: number;
  y: number;
  text: string;
}

export interface PaintedText {
  lines: PaintedLine[];
  size: number;
  angle: number;
}

export interface Painted {
  rects: Rect[];
  quads: string[];
  image: { href: string; transform: string } | null;
  polylines: string[];
  ellipse: Ellipse | null;
  note: Rect | null;
  text: PaintedText | null;
  strokeWidth: number;
  box: Rect | null;
}

function screenQuads(
  annotation: Annotation,
  size: PageSize,
  scale: number,
  rotation: number,
): string[] {
  return polygonsOf(annotation).map((polygon) =>
    strokeToScreen(polygon, size, scale, rotation)
      .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(' '),
  );
}

function polylinesOf(
  annotation: Annotation,
  size: PageSize,
  scale: number,
  rotation: number,
): string[] {
  return (annotation.ink ?? [])
    .filter((stroke) => stroke.length > 0)
    .map((stroke) =>
      strokeToScreen(stroke, size, scale, rotation)
        .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
        .join(' '),
    );
}

function paintedText(
  annotation: Annotation,
  size: PageSize,
  scale: number,
  rotation: number,
): PaintedText | null {
  const rect = annotation.rect;
  if (annotation.kind !== 'freetext' || !rect) return null;

  const fontSize = fontSizeOf(annotation);
  const leading = lineHeight(fontSize);
  const origin = textOrigin(rect, fontSize);
  const lines = linesOf(annotation, measureHelvetica);

  return {
    lines: lines.map((text, index) => {
      const point = toScreenPoint(
        { x: origin.x, y: origin.y - leading * index },
        size,
        scale,
        rotation,
      );
      return { x: point.x, y: point.y, text };
    }),
    size: fontSize * scale,
    angle: ((size.rotation + rotation) % 360 + 360) % 360,
  };
}

export function paintBox(
  annotation: Annotation,
  size: PageSize,
  scale: number,
  rotation: number,
): Rect | null {
  if (annotation.kind === 'note' && annotation.rect) {
    return toScreenRect(
      { x: annotation.rect.x, y: annotation.rect.y, width: NOTE_SIZE, height: NOTE_SIZE },
      size,
      scale,
      rotation,
    );
  }
  if (annotation.rect) return toScreenRect(annotation.rect, size, scale, rotation);

  const points = [
    ...(annotation.quads ?? []).flatMap((quad) => quadPoints(quad)),
    ...(annotation.ink ?? []).flat(),
  ];
  if (points.length === 0) return null;
  return boundsOfPoints(strokeToScreen(points, size, scale, rotation));
}

export function paintAnnotation(
  annotation: Annotation,
  size: PageSize,
  scale: number,
  rotation: number,
): Painted {
  const box = paintBox(annotation, size, scale, rotation);
  const inset = (SHAPE_WIDTH * scale) / 2;
  const border =
    annotation.kind === 'rect' && annotation.rect
      ? toScreenRect(annotation.rect, size, scale, rotation)
      : null;
  const shape = border
    ? {
        x: border.x + inset,
        y: border.y + inset,
        width: Math.max(0, border.width - inset * 2),
        height: Math.max(0, border.height - inset * 2),
      }
    : null;
  const round =
    annotation.kind === 'ellipse' && annotation.rect
      ? toScreenRect(annotation.rect, size, scale, rotation)
      : null;

  const quad = annotation.quads?.[0];
  const image =
    annotation.kind === 'stamp' && annotation.image && quad
      ? {
          href: annotation.image,
          transform: `matrix(${matrixText(screenMatrixOf(quad, size, scale, rotation))})`,
        }
      : null;

  return {
    rects: shape ? [shape] : [],
    quads: annotation.kind === 'stamp' ? [] : screenQuads(annotation, size, scale, rotation),
    image,
    polylines: annotation.kind === 'ink' ? polylinesOf(annotation, size, scale, rotation) : [],
    ellipse: round
      ? {
          cx: round.x + round.width / 2,
          cy: round.y + round.height / 2,
          rx: Math.max(0, round.width / 2 - inset),
          ry: Math.max(0, round.height / 2 - inset),
        }
      : null,
    note: annotation.kind === 'note' ? box : null,
    text: paintedText(annotation, size, scale, rotation),
    strokeWidth: (annotation.kind === 'ink' ? INK_WIDTH : SHAPE_WIDTH) * scale,
    box,
  };
}

export function hitBox(
  annotation: Annotation,
  size: PageSize,
  scale: number,
  rotation: number,
  slack = 4,
): Rect | null {
  const box = paintBox(annotation, size, scale, rotation);
  if (!box) return null;
  return {
    x: box.x - slack,
    y: box.y - slack,
    width: box.width + slack * 2,
    height: box.height + slack * 2,
  };
}
