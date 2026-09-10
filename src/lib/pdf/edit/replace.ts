import { bytesOfWide, codesOfWide } from './cmap';
import { encodeText, type EncodedText } from './encoding';
import { advanceOf, type TextRun } from './runs';
import { encodeLiteral } from './tokens';

export type RefusalReason = 'font' | 'characters' | 'space' | 'shape' | 'empty';

export interface EditableFont {
  editable: boolean;
  measurable: boolean;
  wide?: boolean;
  widthOf(code: number): number;
  toUnicode(bytes: string): string;
  fromUnicode(value: string): EncodedText;
}

export interface Replacement {
  ok: true;
  source: string;
  bytes: string;
  advance: number;
  slack: number;
}

export interface Refusal {
  ok: false;
  reason: RefusalReason;
  detail: string;
}

export type EditOutcome = Replacement | Refusal;

export function buildReplacement(
  run: TextRun,
  value: string,
  font: EditableFont | null,
): EditOutcome {
  if (!font || !font.editable || !font.measurable) {
    return { ok: false, reason: 'font', detail: run.font };
  }
  if (run.operator === "'" || run.operator === '"') {
    return { ok: false, reason: 'shape', detail: run.operator };
  }
  if (value.trim() === '') {
    return { ok: false, reason: 'empty', detail: '' };
  }

  const encoded = font.fromUnicode(value);
  if (encoded.missing.length > 0) {
    return { ok: false, reason: 'characters', detail: encoded.missing.join(' ') };
  }

  const advance = advanceOf(
    encoded.bytes,
    font,
    run.size,
    run.charSpacing,
    run.wordSpacing,
    run.horizontal,
  );

  const slack = run.advance - advance;
  if (slack < -0.01) {
    return { ok: false, reason: 'space', detail: (-slack).toFixed(1) };
  }

  const width = run.size * run.horizontal;
  const kern = width === 0 ? 0 : (slack / width) * 1000;
  const written = font.wide === true ? encodeHex(encoded.bytes) : encodeLiteral(encoded.bytes);
  const source =
    Math.abs(kern) < 0.05 ? `${written} Tj` : `[${written} ${(-kern).toFixed(2)}] TJ`;

  return { ok: true, source, bytes: encoded.bytes, advance, slack };
}

export function spliceSource(
  source: string,
  edits: Array<{ start: number; end: number; text: string }>,
): string {
  const ordered = [...edits].sort((a, b) => b.start - a.start);
  let out = source;
  for (const edit of ordered) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out;
}

export function encodeHex(bytes: string): string {
  let out = '';
  for (let index = 0; index < bytes.length; index += 1) {
    out += (bytes.charCodeAt(index) & 0xff).toString(16).padStart(2, '0');
  }
  return `<${out}>`;
}

export function wideFont(
  widths: Map<number, number>,
  fallback: number,
  toText: Map<number, string>,
  toCode: Map<string, number>,
  editable: boolean,
): EditableFont {
  return {
    editable,
    measurable: widths.size > 0 || fallback > 0,
    wide: true,
    widthOf(code) {
      return widths.get(code) ?? fallback;
    },
    toUnicode(bytes) {
      let out = '';
      for (const code of codesOfWide(bytes)) out += toText.get(code) ?? '';
      return out;
    },
    fromUnicode(value) {
      const codes: number[] = [];
      const missing: string[] = [];
      for (const char of value) {
        const code = toCode.get(char);
        if (code === undefined) {
          if (!missing.includes(char)) missing.push(char);
          continue;
        }
        codes.push(code);
      }
      return { bytes: bytesOfWide(codes), missing };
    },
  };
}

export function simpleFont(
  widths: Map<number, number>,
  fallback: number,
  table: Map<number, string>,
  back: Map<string, number>,
  editable: boolean,
): EditableFont {
  return {
    editable,
    measurable: widths.size > 0 || fallback > 0,
    widthOf(code) {
      return widths.get(code) ?? fallback;
    },
    toUnicode(bytes) {
      let out = '';
      for (const char of bytes) out += table.get(char.charCodeAt(0)) ?? '';
      return out;
    },
    fromUnicode(value) {
      return encodeText(value, back);
    },
  };
}
