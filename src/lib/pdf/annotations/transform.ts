import { boundsOf, type Annotation, type AnnotationKind, type Point, type Quad, type Rect } from './model';

export const MIN_SIZE = 4;

export function canResize(kind: AnnotationKind): boolean {
  return kind !== 'note';
}

export function canRotate(kind: AnnotationKind): boolean {
  return kind === 'highlight' || kind === 'underline' || kind === 'strikeout' || kind === 'ink';
}

type Move = (point: Point) => Point;

function mapQuad(quad: Quad, move: Move): Quad {
  const one = move({ x: quad.x1, y: quad.y1 });
  const two = move({ x: quad.x2, y: quad.y2 });
  const three = move({ x: quad.x3, y: quad.y3 });
  const four = move({ x: quad.x4, y: quad.y4 });
  return {
    x1: one.x,
    y1: one.y,
    x2: two.x,
    y2: two.y,
    x3: three.x,
    y3: three.y,
    x4: four.x,
    y4: four.y,
  };
}

function mapAnnotation(annotation: Annotation, move: Move): Annotation {
  const next: Annotation = { ...annotation };
  if (annotation.quads) next.quads = annotation.quads.map((quad) => mapQuad(quad, move));
  if (annotation.ink) next.ink = annotation.ink.map((stroke) => stroke.map(move));
  if (annotation.rect) {
    const corner = move({ x: annotation.rect.x, y: annotation.rect.y });
    const far = move({
      x: annotation.rect.x + annotation.rect.width,
      y: annotation.rect.y + annotation.rect.height,
    });
    next.rect = {
      x: Math.min(corner.x, far.x),
      y: Math.min(corner.y, far.y),
      width: Math.abs(far.x - corner.x),
      height: Math.abs(far.y - corner.y),
    };
  }
  return next;
}

export function movedBy(annotation: Annotation, dx: number, dy: number): Annotation {
  if (dx === 0 && dy === 0) return annotation;
  return mapAnnotation(annotation, (point) => ({ x: point.x + dx, y: point.y + dy }));
}

export function scaledInto(annotation: Annotation, from: Rect, to: Rect): Annotation {
  if (!canResize(annotation.kind)) return annotation;
  if (from.width <= 0 || from.height <= 0) return annotation;

  const scaleX = to.width / from.width;
  const scaleY = to.height / from.height;
  return mapAnnotation(annotation, (point) => ({
    x: to.x + (point.x - from.x) * scaleX,
    y: to.y + (point.y - from.y) * scaleY,
  }));
}

export function rotatedAround(
  annotation: Annotation,
  centre: Point,
  radians: number,
): Annotation {
  if (!canRotate(annotation.kind)) return annotation;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return mapAnnotation(annotation, (point) => {
    const x = point.x - centre.x;
    const y = point.y - centre.y;
    return { x: centre.x + x * cos - y * sin, y: centre.y + x * sin + y * cos };
  });
}

export function boundsFrom(anchor: Point, pointer: Point): Rect {
  const width = Math.max(MIN_SIZE, Math.abs(pointer.x - anchor.x));
  const height = Math.max(MIN_SIZE, Math.abs(pointer.y - anchor.y));
  return {
    x: pointer.x < anchor.x ? anchor.x - width : anchor.x,
    y: pointer.y < anchor.y ? anchor.y - height : anchor.y,
    width,
    height,
  };
}

export function centreOf(annotation: Annotation): Point | null {
  const bounds = boundsOf(annotation);
  if (!bounds) return null;
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

export function angleBetween(centre: Point, from: Point, to: Point): number {
  const before = Math.atan2(from.y - centre.y, from.x - centre.x);
  const after = Math.atan2(to.y - centre.y, to.x - centre.x);
  return after - before;
}
