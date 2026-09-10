import { hexToRgb, num } from './appearance';
import { HELVETICA_WIDTHS } from './helvetica';
import type { Annotation, Rect } from './model';

export const DEFAULT_FONT_SIZE = 12;
export const TEXT_PADDING = 2;
export const LINE_FACTOR = 1.18;

export interface Measure {
  (text: string, size: number): number;
}

export function measureHelvetica(text: string, size: number): number {
  let total = 0;
  for (const letter of text) {
    const code = letter.codePointAt(0) ?? 32;
    total += HELVETICA_WIDTHS[code <= 255 ? code : 63] ?? 0;
  }
  return (total / 1000) * size;
}

export function exact(value: number): number {
  return Math.round(value * 100000) / 100000;
}

export function fontSizeOf(annotation: Annotation): number {
  const size = annotation.fontSize;
  return typeof size === 'number' && size >= 4 && size <= 96 ? size : DEFAULT_FONT_SIZE;
}

export function lineHeight(size: number): number {
  return size * LINE_FACTOR;
}

function breakLongWord(word: string, width: number, size: number, measure: Measure): string[] {
  const pieces: string[] = [];
  let current = '';
  for (const letter of word) {
    const tried = current + letter;
    if (current !== '' && measure(tried, size) > width) {
      pieces.push(current);
      current = letter;
      continue;
    }
    current = tried;
  }
  if (current !== '') pieces.push(current);
  return pieces;
}

export function wrapText(text: string, width: number, size: number, measure: Measure): string[] {
  const lines: string[] = [];
  const room = Math.max(1, width);

  for (const paragraph of text.split(/\r?\n/)) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of paragraph.split(/\s+/).filter((entry) => entry !== '')) {
      const tried = current === '' ? word : `${current} ${word}`;
      if (current !== '' && measure(tried, size) > room) {
        lines.push(current);
        current = word;
      } else {
        current = tried;
      }

      if (measure(current, size) > room) {
        const pieces = breakLongWord(current, room, size, measure);
        current = pieces.pop() ?? '';
        for (const piece of pieces) lines.push(piece);
      }
    }
    lines.push(current);
  }

  return lines;
}

export function linesOf(annotation: Annotation, measure: Measure): string[] {
  const rect = annotation.rect;
  if (!rect) return [];
  const size = fontSizeOf(annotation);
  return wrapText(annotation.contents, rect.width - TEXT_PADDING * 2, size, measure);
}

export function textOrigin(rect: Rect, size: number): { x: number; y: number } {
  return { x: rect.x + TEXT_PADDING, y: rect.y + rect.height - TEXT_PADDING - size };
}

export function escapeLiteral(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function winAnsi(text: string): string {
  return [...text]
    .map((letter) => (letter.codePointAt(0)! <= 255 ? letter : '?'))
    .join('');
}

export function freeTextStream(annotation: Annotation, measure: Measure, resource = 'ReaderF'): string {
  const rect = annotation.rect;
  if (!rect) return '';
  const lines = linesOf(annotation, measure);
  if (lines.length === 0) return '';

  const size = fontSizeOf(annotation);
  const leading = lineHeight(size);
  const origin = textOrigin(rect, size);
  const [r, g, b] = hexToRgb(annotation.color).map(exact);

  const body: string[] = [
    'BT',
    `/${resource} ${num(size)} Tf`,
    `${num(leading)} TL`,
    `${r} ${g} ${b} rg`,
    `${num(origin.x)} ${num(origin.y)} Td`,
  ];

  lines.forEach((line, index) => {
    if (index > 0) body.push('T*');
    body.push(`(${escapeLiteral(winAnsi(line))}) Tj`);
  });

  body.push('ET');
  return body.join('\n');
}
