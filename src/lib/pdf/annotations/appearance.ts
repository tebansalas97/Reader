import { boundsOf, type Annotation, type Point, type Rect } from './model';
import { polygonsOf } from './shapes';

export const INK_WIDTH = 2;
export const SHAPE_WIDTH = 1.5;
export const NOTE_SIZE = 22;

export function num(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

export function hexToRgb(color: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return [0, 0, 0];
  const value = Number.parseInt(match[1]!, 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function pdfDate(ms: number): string {
  const date = new Date(Number.isFinite(ms) && ms > 0 ? ms : Date.now());
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    'D:',
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    'Z',
  ].join('');
}

function padded(rect: Rect, padding: number): Rect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

export function appearanceBounds(annotation: Annotation): Rect | null {
  if (annotation.kind === 'note') {
    if (!annotation.rect) return null;
    return { x: annotation.rect.x, y: annotation.rect.y, width: NOTE_SIZE, height: NOTE_SIZE };
  }

  const bounds = boundsOf(annotation);
  if (!bounds) return null;
  if (annotation.kind === 'ink') return padded(bounds, INK_WIDTH);
  if (annotation.kind === 'rect' || annotation.kind === 'ellipse') {
    return padded(bounds, SHAPE_WIDTH);
  }
  return bounds;
}

function fillColor(color: string): string {
  const [r, g, b] = hexToRgb(color);
  return `${num(r)} ${num(g)} ${num(b)} rg`;
}

function strokeColor(color: string): string {
  const [r, g, b] = hexToRgb(color);
  return `${num(r)} ${num(g)} ${num(b)} RG`;
}

function rectPath(rect: Rect): string {
  return `${num(rect.x)} ${num(rect.y)} ${num(rect.width)} ${num(rect.height)} re`;
}

function polygonPath(points: Point[]): string {
  const [first, ...rest] = points;
  if (!first) return '';
  return [
    `${num(first.x)} ${num(first.y)} m`,
    ...rest.map((point) => `${num(point.x)} ${num(point.y)} l`),
    'h',
  ].join('\n');
}

function quadStream(annotation: Annotation, multiply: boolean): string {
  const polygons = polygonsOf(annotation);
  if (polygons.length === 0) return '';
  const head = multiply ? ['/GSMul gs'] : [];
  return [...head, fillColor(annotation.color), ...polygons.map(polygonPath), 'f'].join('\n');
}

function inkStream(annotation: Annotation): string {
  const strokes = (annotation.ink ?? []).filter((stroke) => stroke.length > 0);
  if (strokes.length === 0) return '';

  const body = strokes.map((stroke) => {
    const [first, ...rest] = stroke;
    const path = [`${num(first!.x)} ${num(first!.y)} m`];
    for (const point of rest) path.push(`${num(point.x)} ${num(point.y)} l`);
    if (rest.length === 0) path.push(`${num(first!.x)} ${num(first!.y)} l`);
    path.push('S');
    return path.join('\n');
  });

  return [strokeColor(annotation.color), `${num(INK_WIDTH)} w`, '1 J', '1 j', ...body].join('\n');
}

function shapeRect(annotation: Annotation): Rect | null {
  if (!annotation.rect) return null;
  const half = SHAPE_WIDTH / 2;
  return {
    x: annotation.rect.x + half,
    y: annotation.rect.y + half,
    width: Math.max(0, annotation.rect.width - SHAPE_WIDTH),
    height: Math.max(0, annotation.rect.height - SHAPE_WIDTH),
  };
}

function squareStream(annotation: Annotation): string {
  const rect = shapeRect(annotation);
  if (!rect) return '';
  return [strokeColor(annotation.color), `${num(SHAPE_WIDTH)} w`, rectPath(rect), 'S'].join('\n');
}

function ellipseStream(annotation: Annotation): string {
  const rect = shapeRect(annotation);
  if (!rect) return '';

  const kappa = 0.5523;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const rx = rect.width / 2;
  const ry = rect.height / 2;
  const ox = rx * kappa;
  const oy = ry * kappa;

  return [
    strokeColor(annotation.color),
    `${num(SHAPE_WIDTH)} w`,
    `${num(cx - rx)} ${num(cy)} m`,
    `${num(cx - rx)} ${num(cy + oy)} ${num(cx - ox)} ${num(cy + ry)} ${num(cx)} ${num(cy + ry)} c`,
    `${num(cx + ox)} ${num(cy + ry)} ${num(cx + rx)} ${num(cy + oy)} ${num(cx + rx)} ${num(cy)} c`,
    `${num(cx + rx)} ${num(cy - oy)} ${num(cx + ox)} ${num(cy - ry)} ${num(cx)} ${num(cy - ry)} c`,
    `${num(cx - ox)} ${num(cy - ry)} ${num(cx - rx)} ${num(cy - oy)} ${num(cx - rx)} ${num(cy)} c`,
    'S',
  ].join('\n');
}

function noteStream(annotation: Annotation): string {
  const bounds = appearanceBounds(annotation);
  if (!bounds) return '';

  const x = bounds.x;
  const y = bounds.y;
  const size = NOTE_SIZE;
  const bubbleBottom = y + size * 0.3;
  const bubbleTop = y + size * 0.9;
  const left = x + size * 0.1;
  const right = x + size * 0.9;
  const radius = size * 0.18;

  return [
    fillColor(annotation.color),
    '0.15 0.15 0.15 RG',
    '0.7 w',
    `${num(left + radius)} ${num(bubbleBottom)} m`,
    `${num(right - radius)} ${num(bubbleBottom)} l`,
    `${num(right)} ${num(bubbleBottom)} ${num(right)} ${num(bubbleBottom + radius)} ${num(right)} ${num(bubbleBottom + radius)} c`,
    `${num(right)} ${num(bubbleTop - radius)} l`,
    `${num(right)} ${num(bubbleTop)} ${num(right - radius)} ${num(bubbleTop)} ${num(right - radius)} ${num(bubbleTop)} c`,
    `${num(left + radius)} ${num(bubbleTop)} l`,
    `${num(left)} ${num(bubbleTop)} ${num(left)} ${num(bubbleTop - radius)} ${num(left)} ${num(bubbleTop - radius)} c`,
    `${num(left)} ${num(bubbleBottom + radius)} l`,
    `${num(left)} ${num(bubbleBottom)} ${num(left + radius)} ${num(bubbleBottom)} ${num(left + radius)} ${num(bubbleBottom)} c`,
    'h',
    `${num(left + size * 0.2)} ${num(bubbleBottom)} m`,
    `${num(left + size * 0.16)} ${num(y + size * 0.08)} l`,
    `${num(left + size * 0.44)} ${num(bubbleBottom)} l`,
    'h',
    'B',
    '1 1 1 RG',
    '1 w',
    `${num(left + size * 0.16)} ${num(y + size * 0.66)} m`,
    `${num(right - size * 0.16)} ${num(y + size * 0.66)} l`,
    'S',
    `${num(left + size * 0.16)} ${num(y + size * 0.48)} m`,
    `${num(right - size * 0.34)} ${num(y + size * 0.48)} l`,
    'S',
  ].join('\n');
}

export function appearanceStream(annotation: Annotation): string {
  switch (annotation.kind) {
    case 'highlight':
      return quadStream(annotation, true);
    case 'underline':
    case 'strikeout':
      return quadStream(annotation, false);
    case 'ink':
      return inkStream(annotation);
    case 'rect':
      return squareStream(annotation);
    case 'ellipse':
      return ellipseStream(annotation);
    case 'note':
      return noteStream(annotation);
    default:
      return '';
  }
}

export function needsMultiply(annotation: Annotation): boolean {
  return annotation.kind === 'highlight';
}

export function quadNumbers(annotation: Annotation): number[] {
  const flat: number[] = [];
  for (const quad of annotation.quads ?? []) {
    flat.push(quad.x1, quad.y1, quad.x2, quad.y2, quad.x3, quad.y3, quad.x4, quad.y4);
  }
  return flat;
}

export function inkNumbers(annotation: Annotation): number[][] {
  return (annotation.ink ?? [])
    .filter((stroke) => stroke.length > 0)
    .map((stroke) => stroke.flatMap((point) => [point.x, point.y]));
}

export function rectNumbers(rect: Rect): number[] {
  return [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height];
}
