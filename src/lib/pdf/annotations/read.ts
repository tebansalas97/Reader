import type { PdfHandle } from '../document';
import { rectToQuad } from './geometry';
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

const KIND_BY_TYPE: Record<number, AnnotationKind> = {
  1: 'note',
  3: 'freetext',
  5: 'rect',
  6: 'ellipse',
  9: 'highlight',
  10: 'underline',
  12: 'strikeout',
  13: 'stamp',
  15: 'ink',
};

export const DEFAULT_COLOR = '#ffd400';

export function kindOf(annotationType: unknown): AnnotationKind | null {
  if (typeof annotationType !== 'number') return null;
  return KIND_BY_TYPE[annotationType] ?? null;
}

function channel(value: number): string {
  return Math.min(255, Math.max(0, Math.round(value))).toString(16).padStart(2, '0');
}

export function colorOf(color: unknown): string {
  if (!color) return DEFAULT_COLOR;
  const values = Array.from(color as ArrayLike<number>);
  if (values.length < 3) return DEFAULT_COLOR;
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    return DEFAULT_COLOR;
  }
  return `#${channel(values[0]!)}${channel(values[1]!)}${channel(values[2]!)}`;
}

export function refKeyOf(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  return /^\d+R\d*$/.test(id) ? id : null;
}

export function parsePdfDate(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const match = /^D?:?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([+-Z])?(\d{2})?'?(\d{2})?/.exec(
    value,
  );
  if (!match) return 0;

  const year = Number(match[1]);
  const month = Number(match[2] ?? '1') - 1;
  const day = Number(match[3] ?? '1');
  const hour = Number(match[4] ?? '0');
  const minute = Number(match[5] ?? '0');
  const second = Number(match[6] ?? '0');
  const stamp = Date.UTC(year, month, day, hour, minute, second);
  if (!Number.isFinite(stamp)) return 0;

  const sign = match[7];
  if (!sign || sign === 'Z') return stamp;
  const offset = (Number(match[8] ?? '0') * 60 + Number(match[9] ?? '0')) * 60 * 1000;
  return sign === '+' ? stamp - offset : stamp + offset;
}

function numbersOf(value: unknown): number[] | null {
  if (typeof value !== 'object' || value === null) return null;
  const list = Array.from(value as ArrayLike<unknown>);
  if (list.length === 0) return null;
  if (list.every((entry) => typeof entry === 'number' && Number.isFinite(entry))) {
    return list as number[];
  }
  const points: number[] = [];
  for (const entry of list) {
    const point = entry as { x?: unknown; y?: unknown };
    if (typeof point?.x !== 'number' || typeof point?.y !== 'number') return null;
    points.push(point.x, point.y);
  }
  return points;
}

export function quadsOf(value: unknown): Quad[] {
  const flat = numbersOf(value);
  if (!flat) return [];
  const quads: Quad[] = [];
  for (let i = 0; i + 7 < flat.length; i += 8) {
    quads.push({
      x1: flat[i]!,
      y1: flat[i + 1]!,
      x2: flat[i + 2]!,
      y2: flat[i + 3]!,
      x3: flat[i + 4]!,
      y3: flat[i + 5]!,
      x4: flat[i + 6]!,
      y4: flat[i + 7]!,
    });
  }
  return quads;
}

export function inkOf(value: unknown): Point[][] {
  if (!Array.isArray(value)) return [];
  const strokes: Point[][] = [];
  for (const raw of value) {
    const flat = numbersOf(raw);
    if (!flat) continue;
    const stroke: Point[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) stroke.push({ x: flat[i]!, y: flat[i + 1]! });
    if (stroke.length > 0) strokes.push(stroke);
  }
  return strokes;
}

export function rectOf(value: unknown): Rect | null {
  const flat = numbersOf(value);
  if (!flat || flat.length < 4) return null;
  const x = Math.min(flat[0]!, flat[2]!);
  const y = Math.min(flat[1]!, flat[3]!);
  return {
    x,
    y,
    width: Math.abs(flat[2]! - flat[0]!),
    height: Math.abs(flat[3]! - flat[1]!),
  };
}

interface RawAnnotation {
  annotationType?: unknown;
  id?: unknown;
  color?: unknown;
  opacity?: unknown;
  rect?: unknown;
  quadPoints?: unknown;
  inkLists?: unknown;
  contentsObj?: { str?: unknown };
  titleObj?: { str?: unknown };
  creationDate?: unknown;
  modificationDate?: unknown;
  hidden?: unknown;
  defaultAppearanceData?: { fontSize?: unknown; fontColor?: unknown };
}

function textOf(holder: { str?: unknown } | undefined): string {
  return typeof holder?.str === 'string' ? holder.str : '';
}

function textColorOf(raw: RawAnnotation): string | null {
  const found = raw.defaultAppearanceData?.fontColor;
  if (!found) return null;
  const values = Array.from(found as ArrayLike<number>);
  if (values.length < 3) return null;
  return `#${channel(values[0]!)}${channel(values[1]!)}${channel(values[2]!)}`;
}

function fontSizeIn(raw: RawAnnotation): number | null {
  const size = raw.defaultAppearanceData?.fontSize;
  return typeof size === 'number' && size > 0 ? size : null;
}

export function annotationFrom(raw: RawAnnotation, page: number): Annotation | null {
  const kind = kindOf(raw.annotationType);
  if (!kind) return null;
  const ref = refKeyOf(raw.id);
  if (!ref) return null;

  const rect = rectOf(raw.rect);
  if (kind === 'stamp') {
    if (!rect) return null;
    return {
      id: newAnnotationId(),
      page,
      kind,
      color: colorOf(raw.color),
      opacity: 1,
      contents: textOf(raw.contentsObj),
      author: textOf(raw.titleObj),
      createdMs: parsePdfDate(raw.creationDate) || parsePdfDate(raw.modificationDate),
      origin: 'file',
      ref,
      quads: [rectToQuad(rect)],
    };
  }

  const quads = usesQuads(kind)
    ? (() => {
        const read = quadsOf(raw.quadPoints);
        if (read.length > 0) return read;
        return rect ? [rectToQuad(rect)] : [];
      })()
    : [];
  const ink = kind === 'ink' ? inkOf(raw.inkLists) : [];

  if (usesQuads(kind) && quads.length === 0) return null;
  if (kind === 'ink' && ink.length === 0) return null;
  if (usesRect(kind) && !rect) return null;

  const opacity =
    typeof raw.opacity === 'number' && Number.isFinite(raw.opacity)
      ? Math.min(1, Math.max(0, raw.opacity))
      : 1;

  const size = kind === 'freetext' ? fontSizeIn(raw) : null;

  return {
    id: newAnnotationId(),
    page,
    kind,
    color: (kind === 'freetext' ? textColorOf(raw) : null) ?? colorOf(raw.color),
    opacity,
    contents: textOf(raw.contentsObj),
    author: textOf(raw.titleObj),
    createdMs: parsePdfDate(raw.creationDate) || parsePdfDate(raw.modificationDate),
    origin: 'file',
    ref,
    ...(quads.length > 0 ? { quads } : {}),
    ...(ink.length > 0 ? { ink } : {}),
    ...(rect ? { rect } : {}),
    ...(size !== null ? { fontSize: size } : {}),
  };
}

export async function readAnnotations(handle: PdfHandle): Promise<Annotation[]> {
  const all: Annotation[] = [];
  for (let number = 1; number <= handle.pageCount; number += 1) {
    const page = await handle.page(number);
    const raw = (await page.getAnnotations({ intent: 'display' }).catch(() => [])) as
      | RawAnnotation[]
      | null;
    for (const entry of raw ?? []) {
      const annotation = annotationFrom(entry, number);
      if (annotation) all.push(annotation);
    }
  }
  return all;
}
