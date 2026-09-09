import type { PageSize } from '../document';
import type { Point, Quad, Rect } from './model';

export type Matrix = [number, number, number, number, number, number];

export function normalizeRotation(rotation: number): number {
  if (!Number.isFinite(rotation)) return 0;
  const quarters = Math.round(rotation / 90) * 90;
  return ((quarters % 360) + 360) % 360;
}

export function totalRotation(size: PageSize, rotation: number): number {
  return normalizeRotation(normalizeRotation(size.rotation) + normalizeRotation(rotation));
}

export function viewportTransform(size: PageSize, scale: number, rotation: number): Matrix {
  const x0 = size.offsetX ?? 0;
  const y0 = size.offsetY ?? 0;
  const centerX = x0 + size.width / 2;
  const centerY = y0 + size.height / 2;

  let a = 1;
  let b = 0;
  let c = 0;
  let d = -1;
  const total = totalRotation(size, rotation);
  if (total === 90) {
    a = 0;
    b = 1;
    c = 1;
    d = 0;
  } else if (total === 180) {
    a = -1;
    b = 0;
    c = 0;
    d = 1;
  } else if (total === 270) {
    a = 0;
    b = -1;
    c = -1;
    d = 0;
  }

  const sideways = a === 0;
  const offsetX = (sideways ? Math.abs(centerY - y0) : Math.abs(centerX - x0)) * scale;
  const offsetY = (sideways ? Math.abs(centerX - x0) : Math.abs(centerY - y0)) * scale;

  return [
    a * scale,
    b * scale,
    c * scale,
    d * scale,
    offsetX - a * scale * centerX - c * scale * centerY,
    offsetY - b * scale * centerX - d * scale * centerY,
  ];
}

export function applyMatrix(matrix: Matrix, point: Point): Point {
  const [a, b, c, d, e, f] = matrix;
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f };
}

export function invertMatrix(matrix: Matrix): Matrix {
  const [a, b, c, d, e, f] = matrix;
  const determinant = a * d - b * c;
  if (determinant === 0 || !Number.isFinite(determinant)) return [1, 0, 0, 1, 0, 0];
  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ];
}

export function multiplyMatrix(outer: Matrix, inner: Matrix): Matrix {
  return [
    outer[0] * inner[0] + outer[2] * inner[1],
    outer[1] * inner[0] + outer[3] * inner[1],
    outer[0] * inner[2] + outer[2] * inner[3],
    outer[1] * inner[2] + outer[3] * inner[3],
    outer[0] * inner[4] + outer[2] * inner[5] + outer[4],
    outer[1] * inner[4] + outer[3] * inner[5] + outer[5],
  ];
}

export function toScreenPoint(
  point: Point,
  size: PageSize,
  scale: number,
  rotation: number,
): Point {
  return applyMatrix(viewportTransform(size, scale, rotation), point);
}

export function toPdfPoint(point: Point, size: PageSize, scale: number, rotation: number): Point {
  return applyMatrix(invertMatrix(viewportTransform(size, scale, rotation)), point);
}

function rectFromCorners(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

export function toScreenRect(rect: Rect, size: PageSize, scale: number, rotation: number): Rect {
  const matrix = viewportTransform(size, scale, rotation);
  return rectFromCorners(
    applyMatrix(matrix, { x: rect.x, y: rect.y }),
    applyMatrix(matrix, { x: rect.x + rect.width, y: rect.y + rect.height }),
  );
}

export function toPdfRect(rect: Rect, size: PageSize, scale: number, rotation: number): Rect {
  const matrix = invertMatrix(viewportTransform(size, scale, rotation));
  return rectFromCorners(
    applyMatrix(matrix, { x: rect.x, y: rect.y }),
    applyMatrix(matrix, { x: rect.x + rect.width, y: rect.y + rect.height }),
  );
}

export function rectToQuad(rect: Rect): Quad {
  const top = rect.y + rect.height;
  const right = rect.x + rect.width;
  return {
    x1: rect.x,
    y1: top,
    x2: right,
    y2: top,
    x3: rect.x,
    y3: rect.y,
    x4: right,
    y4: rect.y,
  };
}

export function quadPoints(quad: Quad): Point[] {
  return [
    { x: quad.x1, y: quad.y1 },
    { x: quad.x2, y: quad.y2 },
    { x: quad.x3, y: quad.y3 },
    { x: quad.x4, y: quad.y4 },
  ];
}

export function boundsOfPoints(points: Point[]): Rect | null {
  if (points.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function quadBounds(quad: Quad): Rect {
  return boundsOfPoints(quadPoints(quad)) as Rect;
}

export function quadToScreenRect(
  quad: Quad,
  size: PageSize,
  scale: number,
  rotation: number,
): Rect {
  const matrix = viewportTransform(size, scale, rotation);
  return boundsOfPoints(quadPoints(quad).map((point) => applyMatrix(matrix, point))) as Rect;
}

export function strokeToScreen(
  stroke: Point[],
  size: PageSize,
  scale: number,
  rotation: number,
): Point[] {
  const matrix = viewportTransform(size, scale, rotation);
  return stroke.map((point) => applyMatrix(matrix, point));
}

export function strokeToPdf(
  stroke: Point[],
  size: PageSize,
  scale: number,
  rotation: number,
): Point[] {
  const matrix = invertMatrix(viewportTransform(size, scale, rotation));
  return stroke.map((point) => applyMatrix(matrix, point));
}

export function insideRect(rect: Rect, point: Point, slack = 0): boolean {
  return (
    point.x >= rect.x - slack &&
    point.x <= rect.x + rect.width + slack &&
    point.y >= rect.y - slack &&
    point.y <= rect.y + rect.height + slack
  );
}
