import {
  newAnnotationId,
  usesQuads,
  usesRect,
  type Annotation,
  type AnnotationKind,
  type Point,
  type Quad,
  type Rect,
} from './model';
import type { RectLike } from './quads';

export const HIGHLIGHT_OPACITY = 0.4;
export const MIN_DRAG = 4;

export interface PageBox {
  page: number;
  rect: RectLike;
}

export interface Draft {
  kind: AnnotationKind;
  page: number;
  color: string;
  author: string;
  quads?: Quad[];
  ink?: Point[][];
  rect?: Rect;
  image?: string;
}

export function opacityFor(kind: AnnotationKind): number {
  return kind === 'highlight' ? HIGHLIGHT_OPACITY : 1;
}

export function createAnnotation(draft: Draft): Annotation | null {
  if (usesQuads(draft.kind) && (draft.quads ?? []).length === 0) return null;
  if (draft.kind === 'ink' && (draft.ink ?? []).length === 0) return null;
  if (usesRect(draft.kind) && !draft.rect) return null;

  return {
    id: newAnnotationId(),
    page: draft.page,
    kind: draft.kind,
    color: draft.color,
    opacity: opacityFor(draft.kind),
    contents: '',
    author: draft.author,
    createdMs: Date.now(),
    origin: 'reader',
    ...(draft.quads ? { quads: draft.quads } : {}),
    ...(draft.ink ? { ink: draft.ink } : {}),
    ...(draft.rect ? { rect: draft.rect } : {}),
    ...(draft.image ? { image: draft.image } : {}),
  };
}

function centre(rect: RectLike): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function contains(box: RectLike, point: Point): boolean {
  return (
    point.x >= box.left &&
    point.x <= box.left + box.width &&
    point.y >= box.top &&
    point.y <= box.top + box.height
  );
}

export function pageOfRect(rect: RectLike, pages: PageBox[]): number | null {
  const point = centre(rect);
  for (const page of pages) {
    if (contains(page.rect, point)) return page.page;
  }
  return null;
}

export function groupByPage(rects: RectLike[], pages: PageBox[]): Map<number, RectLike[]> {
  const grouped = new Map<number, RectLike[]>();
  for (const rect of rects) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    const page = pageOfRect(rect, pages);
    if (page === null) continue;
    const list = grouped.get(page);
    if (list) list.push(rect);
    else grouped.set(page, [rect]);
  }
  return grouped;
}

export function dragRect(start: Point, end: Point): Rect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function bigEnough(rect: Rect): boolean {
  return rect.width >= MIN_DRAG && rect.height >= MIN_DRAG;
}

export function simplify(stroke: Point[], tolerance = 0.75): Point[] {
  if (stroke.length <= 2) return [...stroke];
  const kept: Point[] = [stroke[0]!];
  for (const point of stroke.slice(1, -1)) {
    const last = kept[kept.length - 1]!;
    if (Math.hypot(point.x - last.x, point.y - last.y) >= tolerance) kept.push(point);
  }
  kept.push(stroke[stroke.length - 1]!);
  return kept;
}
