import type { Matrix } from './geometry';
import { applyMatrix, quadPoints, viewportTransform } from './geometry';
import type { Point, Quad, Rect } from './model';
import type { PageSize } from '../document';

export const STAMP_WIDTH = 180;

export function stampQuad(rect: Rect): Quad {
  return {
    x1: rect.x,
    y1: rect.y + rect.height,
    x2: rect.x + rect.width,
    y2: rect.y + rect.height,
    x3: rect.x,
    y3: rect.y,
    x4: rect.x + rect.width,
    y4: rect.y,
  };
}

export function stampRect(anchor: Point, width: number, ratio: number): Rect {
  const height = Math.max(4, width * ratio);
  return { x: anchor.x, y: anchor.y - height, width, height };
}

export function screenMatrixOf(
  quad: Quad,
  size: PageSize,
  scale: number,
  rotation: number,
): Matrix {
  const transform = viewportTransform(size, scale, rotation);
  const [topLeft, topRight, bottomLeft] = quadPoints(quad).map((point) =>
    applyMatrix(transform, point),
  );
  if (!topLeft || !topRight || !bottomLeft) return [1, 0, 0, 1, 0, 0];
  return [
    topRight.x - topLeft.x,
    topRight.y - topLeft.y,
    bottomLeft.x - topLeft.x,
    bottomLeft.y - topLeft.y,
    topLeft.x,
    topLeft.y,
  ];
}

export function pageMatrixOf(quad: Quad): Matrix {
  const [topLeft, topRight, bottomLeft] = quadPoints(quad);
  if (!topLeft || !topRight || !bottomLeft) return [1, 0, 0, 1, 0, 0];
  return [
    topRight.x - topLeft.x,
    topRight.y - topLeft.y,
    topLeft.x - bottomLeft.x,
    topLeft.y - bottomLeft.y,
    bottomLeft.x,
    bottomLeft.y,
  ];
}

export function matrixText(matrix: Matrix): string {
  return matrix.map((value) => (Math.round(value * 1000) / 1000).toString()).join(' ');
}

export function fitInside(width: number, height: number, limit: number): Rect {
  const side = Math.max(width, height);
  if (side <= 0) return { x: 0, y: 0, width: limit, height: limit };
  const factor = side > limit ? limit / side : 1;
  return { x: 0, y: 0, width: Math.round(width * factor), height: Math.round(height * factor) };
}

export function ratioOf(width: number, height: number): number {
  if (width <= 0) return 1;
  return Math.min(8, Math.max(0.02, height / width));
}
