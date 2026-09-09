import type { PageSize } from './document';
import { clampScale, rotatedSize } from './render';

export function anchoredOffset(
  offset: number,
  pointer: number,
  oldScale: number,
  newScale: number,
): number {
  if (oldScale <= 0 || !Number.isFinite(oldScale) || !Number.isFinite(newScale)) return offset;
  const ratio = newScale / oldScale;
  return Math.max(0, (offset + pointer) * ratio - pointer);
}

export function centredOffset(contentWidth: number, viewportWidth: number): number {
  if (contentWidth <= viewportWidth) return 0;
  return (contentWidth - viewportWidth) / 2;
}

export function widestPage(sizes: PageSize[], rotation: number): PageSize | null {
  let widest: PageSize | null = null;
  let best = -1;
  for (const size of sizes) {
    const turned = rotatedSize(size, rotation);
    if (turned.width > best) {
      best = turned.width;
      widest = size;
    }
  }
  return widest;
}

export function tallestPage(sizes: PageSize[], rotation: number): PageSize | null {
  let tallest: PageSize | null = null;
  let best = -1;
  for (const size of sizes) {
    const turned = rotatedSize(size, rotation);
    if (turned.height > best) {
      best = turned.height;
      tallest = size;
    }
  }
  return tallest;
}

export function pageHeights(sizes: PageSize[], scale: number, rotation: number): number[] {
  return sizes.map((size) => rotatedSize(size, rotation).height * scale);
}

export function contentWidth(sizes: PageSize[], scale: number, rotation: number): number {
  const widest = widestPage(sizes, rotation);
  return widest ? rotatedSize(widest, rotation).width * scale : 0;
}

export function wheelZoom(current: number, deltaY: number): number {
  const factor = deltaY < 0 ? 1.12 : 1 / 1.12;
  return clampScale(Math.round(current * factor * 1000) / 1000);
}
