import type { Rect } from '../annotations/model';
import { codesOfWide } from './cmap';
import type { EditableFont } from './replace';
import type { Matrix, TextRun } from './runs';
import { encodeLiteral } from './tokens';

export const DESCENDER = 0.2;

export interface GlyphBox {
  index: number;
  code: number;
  bytes: string;
  advance: number;
  box: Rect;
}

function place(matrix: Matrix, x: number, y: number): { x: number; y: number } {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  };
}

function boxOf(matrix: Matrix, from: number, to: number, size: number): Rect {
  const corners = [
    place(matrix, from, -size * DESCENDER),
    place(matrix, to, -size * DESCENDER),
    place(matrix, to, size),
    place(matrix, from, size),
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function glyphBoxes(run: TextRun, font: EditableFont | null): GlyphBox[] {
  if (!font) return [];
  const wide = font.wide === true;
  const codes: number[] = wide
    ? codesOfWide(run.bytes)
    : Array.from(run.bytes, (letter) => letter.charCodeAt(0));

  const boxes: GlyphBox[] = [];
  let offset = 0;
  codes.forEach((code, index) => {
    const width = (font.widthOf(code) / 1000) * run.size + run.charSpacing;
    const spacing = code === 32 && !wide ? run.wordSpacing : 0;
    const advance = (width + spacing) * run.horizontal;
    boxes.push({
      index,
      code,
      bytes: wide
        ? String.fromCharCode((code >> 8) & 0xff, code & 0xff)
        : String.fromCharCode(code),
      advance,
      box: boxOf(run.matrix, offset, offset + advance, run.size),
    });
    offset += advance;
  });

  return boxes;
}

export function touches(box: Rect, area: Rect): boolean {
  return (
    box.x < area.x + area.width &&
    box.x + box.width > area.x &&
    box.y < area.y + area.height &&
    box.y + box.height > area.y
  );
}

function kernFor(distance: number, run: TextRun): number {
  const width = run.size * run.horizontal;
  return width === 0 ? 0 : (-distance / width) * 1000;
}

function piece(bytes: string, wide: boolean): string {
  if (!wide) return encodeLiteral(bytes);
  let hex = '';
  for (let index = 0; index < bytes.length; index += 1) {
    hex += (bytes.charCodeAt(index) & 0xff).toString(16).padStart(2, '0');
  }
  return `<${hex}>`;
}

export function redactRun(
  run: TextRun,
  font: EditableFont | null,
  areas: Rect[],
): string | null {
  if (run.operator === "'" || run.operator === '"') return null;
  const boxes = glyphBoxes(run, font);
  if (boxes.length === 0) return null;

  const hidden = boxes.map((entry) => areas.some((area) => touches(entry.box, area)));
  if (!hidden.some(Boolean)) return null;

  const wide = font?.wide === true;
  const parts: string[] = [];
  let kept = '';
  let skipped = 0;

  const flushSkipped = (): void => {
    if (skipped === 0) return;
    parts.push(kernFor(skipped, run).toFixed(2));
    skipped = 0;
  };

  const flushKept = (): void => {
    if (kept === '') return;
    parts.push(piece(kept, wide));
    kept = '';
  };

  boxes.forEach((entry, index) => {
    if (hidden[index]) {
      flushKept();
      skipped += entry.advance;
      return;
    }
    flushSkipped();
    kept += entry.bytes;
  });

  flushKept();
  flushSkipped();

  if (parts.length === 0) return '[] TJ';
  return `[${parts.join(' ')}] TJ`;
}

export function coverStream(areas: Rect[]): string {
  if (areas.length === 0) return '';
  const body = areas
    .map((area) => `${area.x} ${area.y} ${area.width} ${area.height} re`)
    .join('\n');
  return ['q', '0 g', body, 'f', 'Q'].join('\n');
}
