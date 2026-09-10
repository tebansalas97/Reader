import type { PDFDocument, PDFObject, PDFPage, PDFRef } from 'pdf-lib';
import {
  appearanceBounds,
  appearanceStream,
  hexToRgb,
  inkNumbers,
  needsMultiply,
  pdfDate,
  quadNumbers,
  rectNumbers,
  SHAPE_WIDTH,
} from './appearance';
import { annotationKey, usesQuads, type Annotation, type AnnotationKind } from './model';

export type PdfLiteral =
  | string
  | number
  | boolean
  | null
  | undefined
  | PDFObject
  | PdfLiteral[]
  | { [key: string]: PdfLiteral };

const SUBTYPES: Record<AnnotationKind, string> = {
  highlight: 'Highlight',
  underline: 'Underline',
  strikeout: 'StrikeOut',
  ink: 'Ink',
  note: 'Text',
  rect: 'Square',
  ellipse: 'Circle',
  stamp: 'Stamp',
};

export class PdfWriteError extends Error {
  reason: 'encrypted' | 'broken';

  constructor(reason: PdfWriteError['reason'], message: string) {
    super(message);
    this.name = 'PdfWriteError';
    this.reason = reason;
  }
}

export function staleRefs(current: Annotation[], original: Annotation[]): Set<string> {
  const alive = new Map<string, Annotation>();
  for (const annotation of current) {
    if (annotation.ref) alive.set(annotation.ref, annotation);
  }

  const stale = new Set<string>();
  for (const annotation of original) {
    if (!annotation.ref) continue;
    const still = alive.get(annotation.ref);
    if (!still) {
      stale.add(annotation.ref);
      continue;
    }
    if (annotation.kind === 'stamp' && typeof annotation.image !== 'string') continue;
    if (annotationKey(still) !== annotationKey(annotation)) stale.add(annotation.ref);
  }
  return stale;
}

export function toCreate(current: Annotation[], original: Annotation[]): Annotation[] {
  const stale = staleRefs(current, original);
  return current.filter((annotation) => {
    if (annotation.kind === 'stamp' && typeof annotation.image !== 'string') return false;
    return !annotation.ref || stale.has(annotation.ref);
  });
}

function rounded(values: number[]): number[] {
  return values.map((value) => Math.round(value * 100) / 100);
}

function colorNumbers(color: string): number[] {
  return hexToRgb(color).map((value) => Math.round(value * 100000) / 100000);
}

function refKey(objectNumber: number, generation: number): string {
  return `${objectNumber}R${generation === 0 ? '' : generation}`;
}

type PdfLib = typeof import('pdf-lib');

export function annotationDict(
  lib: PdfLib,
  document: PDFDocument,
  page: PDFPage,
  annotation: Annotation,
  images: Map<string, PDFRef> = new Map(),
): PDFRef | null {
  const bounds = appearanceBounds(annotation);
  const content = appearanceStream(annotation);
  if (!bounds || content.length === 0) return null;

  const context = document.context;
  const resources: PdfLiteral = needsMultiply(annotation)
    ? { ExtGState: { GSMul: { Type: 'ExtGState', BM: 'Multiply' } } }
    : {};

  if (annotation.kind === 'stamp') {
    const embedded = images.get(annotation.id);
    if (!embedded) return null;
    (resources as { XObject?: PdfLiteral }).XObject = { ReaderImg: embedded };
  }

  const appearance = context.register(
    context.flateStream(content, {
      Type: 'XObject',
      Subtype: 'Form',
      FormType: 1,
      BBox: rounded(rectNumbers(bounds)),
      Resources: resources,
    }),
  );

  const dictionary: Record<string, PdfLiteral> = {
    Type: 'Annot',
    Subtype: SUBTYPES[annotation.kind],
    Rect: rounded(rectNumbers(bounds)),
    F: 4,
    C: colorNumbers(annotation.color),
    CA: Math.round(annotation.opacity * 100) / 100,
    Contents: lib.PDFHexString.fromText(annotation.contents),
    T: lib.PDFHexString.fromText(annotation.author),
    CreationDate: lib.PDFString.of(pdfDate(annotation.createdMs)),
    M: lib.PDFString.of(pdfDate(Date.now())),
    NM: lib.PDFString.of(annotation.id),
    P: page.ref,
    AP: { N: appearance },
  };

  if (annotation.kind === 'stamp') dictionary.Name = 'ReaderImage';
  else if (usesQuads(annotation.kind)) dictionary.QuadPoints = rounded(quadNumbers(annotation));
  if (annotation.kind === 'ink') dictionary.InkList = inkNumbers(annotation).map(rounded);
  if (annotation.kind === 'rect' || annotation.kind === 'ellipse') {
    dictionary.BS = { W: SHAPE_WIDTH, S: 'S' };
  }
  if (annotation.kind === 'note') {
    dictionary.Name = 'Comment';
    dictionary.Open = false;
  }

  return context.register(context.obj(dictionary));
}

export async function loadForWriting(bytes: Uint8Array): Promise<PDFDocument> {
  const lib = await import('pdf-lib');

  let document: PDFDocument;
  try {
    document = await lib.PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/encrypt/i.test(message)) throw new PdfWriteError('encrypted', message);
    throw new PdfWriteError('broken', message);
  }

  if (document.isEncrypted) {
    throw new PdfWriteError('encrypted', 'el documento esta cifrado');
  }

  return document;
}

export async function saveWritten(document: PDFDocument): Promise<Uint8Array> {
  try {
    return await document.save({ useObjectStreams: false });
  } catch (error) {
    throw new PdfWriteError('broken', error instanceof Error ? error.message : String(error));
  }
}

async function embedImages(
  document: PDFDocument,
  annotations: Annotation[],
): Promise<Map<string, PDFRef>> {
  const images = new Map<string, PDFRef>();
  for (const annotation of annotations) {
    if (annotation.kind !== 'stamp' || !annotation.image) continue;
    try {
      const embedded = await document.embedPng(annotation.image);
      images.set(annotation.id, embedded.ref);
    } catch {
      continue;
    }
  }
  return images;
}

export async function applyAnnotations(
  document: PDFDocument,
  current: Annotation[],
  original: Annotation[],
  sourcePages?: PDFPage[],
): Promise<void> {
  const lib = await import('pdf-lib');
  const pages = sourcePages ?? document.getPages();
  const stale = staleRefs(current, original);
  const context = document.context;

  for (const page of pages) {
    const annots = page.node.Annots();
    if (!annots) continue;

    const kept: PdfLiteral[] = [];
    let dropped = false;
    for (let index = 0; index < annots.size(); index += 1) {
      const entry = annots.get(index);
      if (entry instanceof lib.PDFRef) {
        const key = refKey(entry.objectNumber, entry.generationNumber);
        if (stale.has(key)) {
          context.delete(entry);
          dropped = true;
          continue;
        }
      }
      kept.push(entry);
    }
    if (dropped) page.node.set(lib.PDFName.of('Annots'), context.obj(kept));
  }

  const wanted = toCreate(current, original);
  const images = await embedImages(document, wanted);

  for (const annotation of wanted) {
    const page = pages[annotation.page - 1];
    if (!page) continue;
    const ref = annotationDict(lib, document, page, annotation, images);
    if (!ref) continue;

    const annots = page.node.Annots();
    if (annots) annots.push(ref);
    else page.node.set(lib.PDFName.of('Annots'), context.obj([ref]));
  }
}

export async function writeAnnotations(
  bytes: Uint8Array,
  current: Annotation[],
  original: Annotation[],
): Promise<Uint8Array> {
  const document = await loadForWriting(bytes);
  await applyAnnotations(document, current, original);
  return saveWritten(document);
}
