import type { PDFDocument, PDFPage } from 'pdf-lib';
import type { Annotation } from './annotations/model';
import {
  applyAnnotations,
  loadForWriting,
  PdfWriteError,
  saveWritten,
} from './annotations/write';
import { samePlan, withoutLostPages, type PageEdit } from './pages';

export interface PdfSaveInput {
  bytes: Uint8Array;
  pages: PageEdit[];
  savedPages: PageEdit[];
  annotations: Annotation[];
  savedAnnotations: Annotation[];
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
  const lib = await import('pdf-lib');
  const document = await loadForWriting(input.bytes);
  const sourcePages = document.getPages();

  const moved = !samePlan(input.pages, input.savedPages);
  if (moved) applyPlan(lib, document, sourcePages, input.pages);

  await applyAnnotations(
    document,
    withoutLostPages(input.annotations, input.pages),
    withoutLostPages(input.savedAnnotations, input.pages),
    sourcePages,
  );

  return saveWritten(document);
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
