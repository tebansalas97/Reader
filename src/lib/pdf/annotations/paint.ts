import type { PageSize } from '../document';
import { INK_WIDTH, NOTE_SIZE, SHAPE_WIDTH } from './appearance';
import { boundsOfPoints, quadToScreenRect, strokeToScreen, toScreenRect } from './geometry';
import type { Annotation, Rect } from './model';
import { paintedRects, quadRects } from './shapes';

export interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface Painted {
  rects: Rect[];
  polylines: string[];
  ellipse: Ellipse | null;
  note: Rect | null;
  strokeWidth: number;
  box: Rect | null;
}

function screenRects(annotation: Annotation, size: PageSize, scale: number, rotation: number) {
  return paintedRects(annotation).map((rect) => toScreenRect(rect, size, scale, rotation));
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

  const corners = [
    ...quadRects(annotation).map((rect) => quadToScreenRect(
      {
        x1: rect.x,
        y1: rect.y + rect.height,
        x2: rect.x + rect.width,
        y2: rect.y + rect.height,
        x3: rect.x,
        y3: rect.y,
        x4: rect.x + rect.width,
        y4: rect.y,
      },
      size,
      scale,
      rotation,
    )),
    ...(annotation.ink ?? []).map((stroke) => {
      const points = strokeToScreen(stroke, size, scale, rotation);
      return boundsOfPoints(points);
    }),
  ].filter((rect): rect is Rect => rect !== null);

  if (corners.length === 0) return null;
  return boundsOfPoints(
    corners.flatMap((rect) => [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
    ]),
  );
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

  return {
    rects: shape ? [shape] : screenRects(annotation, size, scale, rotation),
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
