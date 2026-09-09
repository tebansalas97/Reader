import { quadBounds } from './geometry';
import { boundsOf, type Annotation, type Quad, type Rect } from './model';

interface RawItem {
  str?: unknown;
  transform?: unknown;
  width?: unknown;
  height?: unknown;
}

function itemBox(item: RawItem): { box: Rect; text: string } | null {
  const text = typeof item.str === 'string' ? item.str : '';
  if (text.trim().length === 0) return null;
  const transform = Array.isArray(item.transform) ? (item.transform as number[]) : null;
  if (!transform || transform.length < 6) return null;

  const height = Math.hypot(transform[1] ?? 0, transform[3] ?? 0) || 1;
  const width = typeof item.width === 'number' ? item.width : 0;
  return {
    text,
    box: { x: transform[4] ?? 0, y: transform[5] ?? 0, width, height },
  };
}

function overlaps(box: Rect, quad: Rect): boolean {
  const centreY = box.y + box.height / 2;
  const from = Math.max(box.x, quad.x);
  const to = Math.min(box.x + box.width, quad.x + quad.width);
  const shared = to - from;
  if (shared <= 0) return false;
  if (centreY < quad.y || centreY > quad.y + quad.height) return false;
  return shared >= Math.min(box.width, quad.width) * 0.35;
}

export function textInQuads(items: unknown[], quads: Quad[]): string {
  if (quads.length === 0) return '';
  const boxes = quads.map(quadBounds);
  const parts: string[] = [];

  for (const raw of items) {
    const item = itemBox(raw as RawItem);
    if (!item) continue;
    if (boxes.some((box) => overlaps(item.box, box))) parts.push(item.text);
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function sortForList(annotations: Annotation[]): Annotation[] {
  return [...annotations].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    const one = boundsOf(a);
    const two = boundsOf(b);
    if (!one || !two) return 0;
    const top = two.y + two.height - (one.y + one.height);
    if (Math.abs(top) > 1) return top;
    return one.x - two.x;
  });
}

export function excerptOf(value: string, limit = 90): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit - 1).trimEnd()}…`;
}

export function labelFor(annotation: Annotation, text: string | null, fallback: string): string {
  const comment = excerptOf(annotation.contents);
  if (comment.length > 0) return comment;
  const under = excerptOf(text ?? '');
  if (under.length > 0) return under;
  return fallback;
}

export function pagesWithQuads(annotations: Annotation[]): number[] {
  const pages = new Set<number>();
  for (const annotation of annotations) {
    if ((annotation.quads ?? []).length > 0) pages.add(annotation.page);
  }
  return [...pages].sort((a, b) => a - b);
}
