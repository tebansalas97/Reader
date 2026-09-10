import type { Point, Rect } from './model';

export const SIGNATURE_WIDTH = 180;

export function boundsOfStrokes(strokes: Point[][]): Rect | null {
  const points = strokes.flat();
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

export function normalisedStrokes(strokes: Point[][]): Point[][] {
  const bounds = boundsOfStrokes(strokes);
  if (!bounds) return [];
  const width = bounds.width || 1;
  const height = bounds.height || 1;
  const side = Math.max(width, height);

  return strokes
    .filter((stroke) => stroke.length > 0)
    .map((stroke) =>
      stroke.map((point) => ({
        x: Math.round(((point.x - bounds.x) / width) * 1000) / 1000,
        y: Math.round(((point.y - bounds.y) / side) * 1000) / 1000,
      })),
    );
}

export function signatureRatio(strokes: Point[][]): number {
  const bounds = boundsOfStrokes(strokes);
  if (!bounds || bounds.width === 0) return 0.35;
  return Math.min(1, Math.max(0.08, bounds.height / bounds.width));
}

export function placedStrokes(strokes: Point[][], target: Rect): Point[][] {
  return strokes.map((stroke) =>
    stroke.map((point) => ({
      x: target.x + point.x * target.width,
      y: target.y + target.height - point.y * target.height,
    })),
  );
}

export function signatureRect(anchor: Point, width: number, ratio: number): Rect {
  const height = Math.max(4, width * ratio);
  return { x: anchor.x, y: anchor.y - height, width, height };
}

export function encodeSignature(strokes: Point[][]): string {
  return JSON.stringify(strokes.map((stroke) => stroke.map((point) => [point.x, point.y])));
}

export function decodeSignature(value: string): Point[][] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const strokes: Point[][] = [];
    for (const raw of parsed) {
      if (!Array.isArray(raw)) continue;
      const stroke: Point[] = [];
      for (const pair of raw) {
        if (!Array.isArray(pair) || pair.length < 2) continue;
        const x = Number(pair[0]);
        const y = Number(pair[1]);
        if (Number.isFinite(x) && Number.isFinite(y)) stroke.push({ x, y });
      }
      if (stroke.length > 0) strokes.push(stroke);
    }
    return strokes;
  } catch {
    return [];
  }
}
