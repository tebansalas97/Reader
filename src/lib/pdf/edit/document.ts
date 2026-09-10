import type { PDFDocument, PDFPage } from 'pdf-lib';
import { encodingNameOf, reverseTable, tableFor } from './encoding';
import { codeMapOf, parseWideWidths } from './cmap';
import { buildReplacement, simpleFont, spliceSource, wideFont, type EditableFont } from './replace';
import { findRuns, originOf, type FontMetrics, type TextRun } from './runs';
import { tokenize, type Token } from './tokens';

export interface TextEdit {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  oldText: string;
  newText: string;
}

export interface PageText {
  page: number;
  source: string;
  tokens: Token[];
  runs: TextRun[];
  fonts: Map<string, EditableFont>;
}

export interface EditReport {
  id: string;
  done: boolean;
  reason?: string;
  detail?: string;
}

const EDITABLE_SUBTYPES = new Set(['Type1', 'TrueType', 'MMType1']);

const STANDARD_NAMES = [
  'Courier-BoldOblique',
  'Courier-Bold',
  'Courier-Oblique',
  'Courier',
  'Helvetica-BoldOblique',
  'Helvetica-Bold',
  'Helvetica-Oblique',
  'Helvetica',
  'Times-BoldItalic',
  'Times-Bold',
  'Times-Italic',
  'Times-Roman',
  'Symbol',
  'ZapfDingbats',
];

const standardWidths = new Map<string, Map<number, number>>();

export function standardNameOf(baseFont: string): string | null {
  const clean = baseFont.replace(/^\//, '').replace(/^[A-Z]{6}\+/, '');
  return STANDARD_NAMES.find((name) => name === clean) ?? null;
}

async function widthsOfStandard(
  lib: PdfLib,
  baseFont: string,
  table: Map<number, string>,
): Promise<Map<number, number>> {
  const name = standardNameOf(baseFont);
  if (!name) return new Map();

  const known = standardWidths.get(name);
  if (known) return known;

  const widths = new Map<number, number>();
  try {
    const scratch = await lib.PDFDocument.create();
    const font = await scratch.embedFont(name as never);
    for (const [code, char] of table) {
      try {
        widths.set(code, Math.round(font.widthOfTextAtSize(char, 1000)));
      } catch {
        continue;
      }
    }
  } catch {
    return widths;
  }

  standardWidths.set(name, widths);
  return widths;
}

function latin1(bytes: Uint8Array): string {
  let out = '';
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    out += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return out;
}

function toBytes(source: string): Uint8Array {
  const bytes = new Uint8Array(source.length);
  for (let index = 0; index < source.length; index += 1) {
    bytes[index] = source.charCodeAt(index) & 0xff;
  }
  return bytes;
}

type PdfLib = typeof import('pdf-lib');

function contentStreams(lib: PdfLib, page: PDFPage): unknown[] {
  const contents = page.node.Contents();
  if (!contents) return [];
  if (contents instanceof lib.PDFArray) {
    const list: unknown[] = [];
    for (let index = 0; index < contents.size(); index += 1) {
      list.push(page.node.context.lookup(contents.get(index)));
    }
    return list;
  }
  return [page.node.context.lookup(page.node.get(lib.PDFName.of('Contents')))];
}

function streamText(lib: PdfLib, stream: unknown): string {
  try {
    if (stream instanceof lib.PDFRawStream) {
      return latin1(lib.decodePDFRawStream(stream).decode());
    }
  } catch {
    return '';
  }
  return '';
}

function numbersOrLists(lib: PdfLib, array: import('pdf-lib').PDFArray): Array<number | number[]> {
  const entries: Array<number | number[]> = [];
  for (let index = 0; index < array.size(); index += 1) {
    const entry = array.lookup(index);
    if (entry instanceof lib.PDFNumber) {
      entries.push(entry.asNumber());
      continue;
    }
    if (entry instanceof lib.PDFArray) {
      const list: number[] = [];
      for (let inner = 0; inner < entry.size(); inner += 1) {
        const value = entry.lookupMaybe(inner, lib.PDFNumber)?.asNumber();
        if (typeof value === 'number') list.push(value);
      }
      entries.push(list);
      continue;
    }
    break;
  }
  return entries;
}

function compositeFont(lib: PdfLib, font: import('pdf-lib').PDFDict): EditableFont | null {
  const encoding = font.lookupMaybe(lib.PDFName.of('Encoding'), lib.PDFName)?.asString() ?? '';
  const identity = encoding.replace(/^\//, '') === 'Identity-H';

  const descendants = font.lookupMaybe(lib.PDFName.of('DescendantFonts'), lib.PDFArray);
  const descendant = descendants ? descendants.lookupMaybe(0, lib.PDFDict) : null;
  const defaultWidth =
    descendant?.lookupMaybe(lib.PDFName.of('DW'), lib.PDFNumber)?.asNumber() ?? 1000;
  const widthArray = descendant?.lookupMaybe(lib.PDFName.of('W'), lib.PDFArray);
  const widths = widthArray ? parseWideWidths(numbersOrLists(lib, widthArray)) : new Map();

  const cmap = streamText(lib, font.lookup(lib.PDFName.of('ToUnicode')));
  const codes = cmap === '' ? { toText: new Map(), toCode: new Map() } : codeMapOf(cmap);

  const editable = identity && codes.toCode.size > 0;
  return wideFont(widths, defaultWidth, codes.toText, codes.toCode, editable);
}

async function readFonts(lib: PdfLib, page: PDFPage): Promise<Map<string, EditableFont>> {
  const fonts = new Map<string, EditableFont>();
  const resources = page.node.Resources();
  const dictionary = resources?.lookupMaybe(lib.PDFName.of('Font'), lib.PDFDict);
  if (!dictionary) return fonts;

  for (const [key] of dictionary.entries()) {
    const name = key.asString().replace(/^\//, '');
    const font = dictionary.lookupMaybe(key, lib.PDFDict);
    if (!font) continue;

    const subtype = font.lookupMaybe(lib.PDFName.of('Subtype'), lib.PDFName)?.asString() ?? '';
    const clean = subtype.replace(/^\//, '');

    if (clean === 'Type0') {
      const composite = compositeFont(lib, font);
      if (composite) fonts.set(name, composite);
      continue;
    }

    const widths = new Map<number, number>();
    const first = font.lookupMaybe(lib.PDFName.of('FirstChar'), lib.PDFNumber)?.asNumber() ?? 0;
    const list = font.lookupMaybe(lib.PDFName.of('Widths'), lib.PDFArray);
    if (list) {
      for (let index = 0; index < list.size(); index += 1) {
        const value = list.lookupMaybe(index, lib.PDFNumber)?.asNumber();
        if (typeof value === 'number') widths.set(first + index, value);
      }
    }

    const descriptor = font.lookupMaybe(lib.PDFName.of('FontDescriptor'), lib.PDFDict);
    const missing = descriptor
      ?.lookupMaybe(lib.PDFName.of('MissingWidth'), lib.PDFNumber)
      ?.asNumber();

    const encodingEntry = font.lookup(lib.PDFName.of('Encoding'));
    let encodingName: string | null = null;
    let hasDifferences = false;
    if (encodingEntry instanceof lib.PDFName) {
      encodingName = encodingEntry.asString().replace(/^\//, '');
    } else if (encodingEntry instanceof lib.PDFDict) {
      const base = encodingEntry.lookupMaybe(lib.PDFName.of('BaseEncoding'), lib.PDFName);
      encodingName = base?.asString().replace(/^\//, '') ?? null;
      hasDifferences = encodingEntry.has(lib.PDFName.of('Differences'));
    }

    const encoding = encodingNameOf(encodingName);
    const table = tableFor(encoding);
    const baseFont = font.lookupMaybe(lib.PDFName.of('BaseFont'), lib.PDFName)?.asString() ?? '';
    const measured = widths.size > 0 ? widths : await widthsOfStandard(lib, baseFont, table);
    const editable =
      EDITABLE_SUBTYPES.has(clean) && encoding !== 'unknown' && !hasDifferences && measured.size > 0;

    fonts.set(name, simpleFont(measured, missing ?? 0, table, reverseTable(table), editable));
  }

  return fonts;
}

export async function readPageText(
  document: PDFDocument,
  page: number,
): Promise<PageText | null> {
  const lib = await import('pdf-lib');
  const target = document.getPages()[page - 1];
  if (!target) return null;

  const streams = contentStreams(lib, target);
  let source = '';
  for (const stream of streams) {
    if (!(stream instanceof lib.PDFRawStream)) continue;
    try {
      source += `${latin1(lib.decodePDFRawStream(stream).decode())}\n`;
    } catch {
      return null;
    }
  }

  const fonts = await readFonts(lib, target);
  const tokens = tokenize(source);
  const lookup = (name: string): FontMetrics | null => fonts.get(name) ?? null;
  return { page, source, tokens, runs: findRuns(tokens, lookup), fonts };
}

function writeSource(lib: PdfLib, document: PDFDocument, page: PDFPage, source: string): void {
  const stream = document.context.flateStream(toBytes(source));
  const ref = document.context.register(stream);
  page.node.set(lib.PDFName.of('Contents'), ref);
}

export function matchRun(runs: TextRun[], edit: TextEdit): TextRun | null {
  let best: TextRun | null = null;
  let closest = Number.POSITIVE_INFINITY;

  for (const run of runs) {
    const origin = originOf(run);
    const distance = Math.hypot(origin.x - edit.x, origin.y - edit.y);
    if (distance > 1.5) continue;
    if (distance < closest) {
      closest = distance;
      best = run;
    }
  }

  return best;
}

export async function applyTextEdits(
  document: PDFDocument,
  edits: TextEdit[],
): Promise<EditReport[]> {
  if (edits.length === 0) return [];
  const lib = await import('pdf-lib');

  const pages = new Map<number, TextEdit[]>();
  for (const edit of edits) {
    const list = pages.get(edit.page);
    if (list) list.push(edit);
    else pages.set(edit.page, [edit]);
  }

  const reports: EditReport[] = [];

  for (const [page, wanted] of pages) {
    const target = document.getPages()[page - 1];
    const text = await readPageText(document, page);
    if (!target || !text) {
      for (const edit of wanted) reports.push({ id: edit.id, done: false, reason: 'unreadable' });
      continue;
    }

    const splices: Array<{ start: number; end: number; text: string }> = [];

    for (const edit of wanted) {
      const run = matchRun(text.runs, edit);
      if (!run) {
        reports.push({ id: edit.id, done: false, reason: 'missing' });
        continue;
      }

      const font = text.fonts.get(run.font) ?? null;
      const outcome = buildReplacement(run, edit.newText, font);
      if (!outcome.ok) {
        reports.push({ id: edit.id, done: false, reason: outcome.reason, detail: outcome.detail });
        continue;
      }

      splices.push({
        start: text.tokens[run.firstToken]!.start,
        end: text.tokens[run.lastToken]!.end,
        text: outcome.source,
      });
      reports.push({ id: edit.id, done: true });
    }

    if (splices.length > 0) {
      writeSource(lib, document, target, spliceSource(text.source, splices));
    }
  }

  return reports;
}
