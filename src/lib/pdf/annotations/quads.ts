import type { PageSize } from '../document';
import { rotatedSize } from '../render';
import { rectToQuad, toPdfRect } from './geometry';
import type { Quad, Rect } from './model';

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

const MIN_SIDE = 0.5;

export function localRects(rects: RectLike[], page: RectLike): Rect[] {
  const out: Rect[] = [];
  for (const rect of rects) {
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) continue;
    if (rect.width < MIN_SIDE || rect.height < MIN_SIDE) continue;

    const left = Math.max(0, rect.left - page.left);
    const top = Math.max(0, rect.top - page.top);
    const right = Math.min(page.width, rect.left - page.left + rect.width);
    const bottom = Math.min(page.height, rect.top - page.top + rect.height);
    if (right - left < MIN_SIDE || bottom - top < MIN_SIDE) continue;

    out.push({ x: left, y: top, width: right - left, height: bottom - top });
  }
  return out;
}

function sameLine(a: Rect, b: Rect): boolean {
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const overlap = bottom - top;
  if (overlap <= 0) return false;
  return overlap >= Math.min(a.height, b.height) * 0.5;
}

export function mergeLines(rects: Rect[], gap = 1): Rect[] {
  const lines: Rect[][] = [];
  for (const rect of rects) {
    const line = lines.find((candidate) => sameLine(candidate[0]!, rect));
    if (line) line.push(rect);
    else lines.push([rect]);
  }

  const merged: Rect[] = [];
  for (const line of lines) {
    const sorted = [...line].sort((a, b) => a.x - b.x);
    let current = { ...sorted[0]! };
    for (const rect of sorted.slice(1)) {
      if (rect.x <= current.x + current.width + gap) {
        const right = Math.max(current.x + current.width, rect.x + rect.width);
        const top = Math.max(current.y + current.height, rect.y + rect.height);
        const bottom = Math.min(current.y, rect.y);
        current = { x: current.x, y: bottom, width: right - current.x, height: top - bottom };
      } else {
        merged.push(current);
        current = { ...rect };
      }
    }
    merged.push(current);
  }

  return merged.sort((a, b) => b.y - a.y || a.x - b.x);
}

export function scaleOf(page: RectLike, size: PageSize, rotation: number): number {
  const display = rotatedSize(size, rotation);
  if (display.width <= 0 || page.width <= 0) return 1;
  return page.width / display.width;
}

export function quadsFromRects(
  rects: RectLike[],
  page: RectLike,
  size: PageSize,
  rotation: number,
): Quad[] {
  const scale = scaleOf(page, size, rotation);
  const inPdf = localRects(rects, page).map((rect) => toPdfRect(rect, size, scale, rotation));
  return mergeLines(inPdf).map(rectToQuad);
}
