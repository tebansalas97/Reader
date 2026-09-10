export type AnnotationKind =
  | 'highlight'
  | 'underline'
  | 'strikeout'
  | 'ink'
  | 'note'
  | 'rect'
  | 'ellipse'
  | 'stamp';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Quad {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
  x4: number;
  y4: number;
}

export interface Annotation {
  id: string;
  page: number;
  kind: AnnotationKind;
  color: string;
  opacity: number;
  contents: string;
  author: string;
  createdMs: number;
  quads?: Quad[];
  ink?: Point[][];
  rect?: Rect;
  image?: string;
  origin: 'reader' | 'file';
  ref?: string;
}

export const QUAD_KINDS: AnnotationKind[] = ['highlight', 'underline', 'strikeout'];
export const IMAGE_KINDS: AnnotationKind[] = ['stamp'];
export const RECT_KINDS: AnnotationKind[] = ['note', 'rect', 'ellipse'];

export function usesQuads(kind: AnnotationKind): boolean {
  return QUAD_KINDS.includes(kind) || IMAGE_KINDS.includes(kind);
}

export function usesImage(kind: AnnotationKind): boolean {
  return IMAGE_KINDS.includes(kind);
}

const digests = new Map<string, string>();
const MAX_DIGESTS = 64;

export function digestOf(value: string): string {
  const known = digests.get(value);
  if (known !== undefined) return known;

  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const digest = `${value.length}:${(hash >>> 0).toString(36)}`;

  if (digests.size >= MAX_DIGESTS) digests.clear();
  digests.set(value, digest);
  return digest;
}

export function usesRect(kind: AnnotationKind): boolean {
  return RECT_KINDS.includes(kind);
}

let counter = 0;

export function newAnnotationId(): string {
  counter += 1;
  return `ann-${Date.now().toString(36)}-${counter.toString(36)}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function quadKey(quad: Quad): string {
  return [quad.x1, quad.y1, quad.x2, quad.y2, quad.x3, quad.y3, quad.x4, quad.y4]
    .map(round)
    .join(',');
}

function rectKey(rect: Rect): string {
  return [rect.x, rect.y, rect.width, rect.height].map(round).join(',');
}

function inkKey(strokes: Point[][]): string {
  return strokes
    .map((stroke) => stroke.map((p) => `${round(p.x)}:${round(p.y)}`).join(' '))
    .join('|');
}

export function annotationKey(annotation: Annotation): string {
  return [
    annotation.page,
    annotation.kind,
    annotation.color.toLowerCase(),
    round(annotation.opacity),
    annotation.contents,
    annotation.origin,
    (annotation.quads ?? []).map(quadKey).join(';'),
    annotation.rect ? rectKey(annotation.rect) : '',
    inkKey(annotation.ink ?? []),
    annotation.image ? digestOf(annotation.image) : '',
  ].join('|');
}

export function sameAnnotation(a: Annotation, b: Annotation): boolean {
  return annotationKey(a) === annotationKey(b);
}

export function sameAnnotations(a: Annotation[], b: Annotation[]): boolean {
  if (a.length !== b.length) return false;
  const left = a.map(annotationKey).sort();
  const right = b.map(annotationKey).sort();
  return left.every((key, index) => key === right[index]);
}

export function boundsOf(annotation: Annotation): Rect | null {
  if (annotation.rect) return annotation.rect;

  const xs: number[] = [];
  const ys: number[] = [];

  for (const quad of annotation.quads ?? []) {
    xs.push(quad.x1, quad.x2, quad.x3, quad.x4);
    ys.push(quad.y1, quad.y2, quad.y3, quad.y4);
  }
  for (const stroke of annotation.ink ?? []) {
    for (const point of stroke) {
      xs.push(point.x);
      ys.push(point.y);
    }
  }

  if (xs.length === 0 || ys.length === 0) return null;
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function withoutAnnotation(list: Annotation[], id: string): Annotation[] {
  return list.filter((a) => a.id !== id);
}

export function replaceAnnotation(list: Annotation[], next: Annotation): Annotation[] {
  return list.map((a) => (a.id === next.id ? next : a));
}
