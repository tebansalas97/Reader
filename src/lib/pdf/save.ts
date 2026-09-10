import type { PDFDocument, PDFPage } from 'pdf-lib';
import type { Annotation } from './annotations/model';
import {
  applyAnnotations,
  loadForWriting,
  PdfWriteError,
  saveWritten,
} from './annotations/write';
import { applyTextEdits, type EditReport, type TextEdit } from './edit/document';
import type { FieldValues, FormField } from './forms/model';
import { applyFields } from './forms/write';
import { samePlan, withoutLostPages, type PageEdit } from './pages';

export interface PdfSaveInput {
  bytes: Uint8Array;
  pages: PageEdit[];
  savedPages: PageEdit[];
  annotations: Annotation[];
  savedAnnotations: Annotation[];
  fields?: FormField[];
  fieldValues?: FieldValues;
  savedFieldValues?: FieldValues;
  edits?: TextEdit[];
}

export interface SavedPdf {
  bytes: Uint8Array;
  edits: EditReport[];
  patched: number;
}

type PdfLib = typeof import('pdf-lib');

function applyPlan(
  lib: PdfLib,
  document: PDFDocument,
  sourcePages: PDFPage[],
  plan: PageEdit[],
): void {
  const wanted = plan
    .map((entry) => ({ entry, page: sourcePages[entry.source - 1] }))
    .filter((item): item is { entry: PageEdit; page: PDFPage } => item.page !== undefined);

  if (wanted.length === 0) throw new PdfWriteError('broken', 'el plan no deja ninguna pagina');

  for (let index = document.getPageCount() - 1; index >= 0; index -= 1) {
    document.removePage(index);
  }

  for (const { entry, page } of wanted) {
    if (entry.rotation !== 0) {
      const base = page.getRotation().angle;
      page.setRotation(lib.degrees((((base + entry.rotation) % 360) + 360) % 360));
    }
    document.addPage(page);
  }
}

export async function buildSavedPdf(input: PdfSaveInput): Promise<Uint8Array> {
  return (await buildSavedPdfWithReport(input)).bytes;
}

export async function buildSavedPdfWithReport(input: PdfSaveInput): Promise<SavedPdf> {
  const lib = await import('pdf-lib');
  const document = await loadForWriting(input.bytes);
  const sourcePages = document.getPages();

  const edits = await applyTextEdits(document, input.edits ?? []);

  await applyFields(
    document,
    input.fields ?? [],
    input.fieldValues ?? {},
    input.savedFieldValues ?? {},
  );

  const moved = !samePlan(input.pages, input.savedPages);
  if (moved) applyPlan(lib, document, sourcePages, input.pages);

  const patched = await applyAnnotations(
    document,
    withoutLostPages(input.annotations, input.pages),
    withoutLostPages(input.savedAnnotations, input.pages),
    sourcePages,
  );

  return { bytes: await saveWritten(document), edits, patched };
}

export async function extractPages(bytes: Uint8Array, sources: number[]): Promise<Uint8Array> {
  const lib = await import('pdf-lib');
  const from = await loadForWriting(bytes);
  const wanted = sources
    .map((source) => source - 1)
    .filter((index) => index >= 0 && index < from.getPageCount());

  if (wanted.length === 0) throw new PdfWriteError('broken', 'no hay paginas que extraer');

  const into = await lib.PDFDocument.create();
  const copied = await into.copyPages(from, wanted);
  for (const page of copied) into.addPage(page);
  return saveWritten(into);
}

export async function insertPages(
  bytes: Uint8Array,
  extra: Uint8Array,
  at: number,
): Promise<Uint8Array> {
  const into = await loadForWriting(bytes);
  const from = await loadForWriting(extra);
  const count = from.getPageCount();
  if (count === 0) throw new PdfWriteError('broken', 'el otro documento no tiene paginas');

  const where = Math.max(0, Math.min(at, into.getPageCount()));
  const copied = await into.copyPages(
    from,
    Array.from({ length: count }, (_, index) => index),
  );
  copied.forEach((page, index) => into.insertPage(where + index, page));
  return saveWritten(into);
}
