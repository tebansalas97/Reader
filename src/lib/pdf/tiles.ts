export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MAX_PIXELS = 4_000_000;
export const TILE_STEP = 256;
export const TILE_MARGIN = 128;

export function pixelsOf(box: Box, density: number): number {
  return Math.max(0, box.width * density) * Math.max(0, box.height * density);
}

export function needsTile(page: Box, density: number, limit = MAX_PIXELS): boolean {
  return pixelsOf(page, density) > limit;
}

function snapDown(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function snapUp(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

export function tileFor(
  page: Box,
  view: Box,
  margin = TILE_MARGIN,
  step = TILE_STEP,
): Box {
  const left = Math.max(0, snapDown(view.x - margin, step));
  const top = Math.max(0, snapDown(view.y - margin, step));
  const right = Math.min(page.width, snapUp(view.x + view.width + margin, step));
  const bottom = Math.min(page.height, snapUp(view.y + view.height + margin, step));

  return {
    x: Math.min(left, Math.max(0, page.width)),
    y: Math.min(top, Math.max(0, page.height)),
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export function sameBox(one: Box | null, other: Box | null): boolean {
  if (one === null || other === null) return one === other;
  return (
    one.x === other.x &&
    one.y === other.y &&
    one.width === other.width &&
    one.height === other.height
  );
}

export function fullPage(page: Box): Box {
  return { x: 0, y: 0, width: page.width, height: page.height };
}
