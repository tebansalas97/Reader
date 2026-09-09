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
    if (!still || annotationKey(still) !== annotationKey(annotation)) stale.add(annotation.ref);
  }
  return stale;
}

export function toCreate(current: Annotation[], original: Annotation[]): Annotation[] {
  const stale = staleRefs(current, original);
  return current.filter((annotation) => !annotation.ref || stale.has(annotation.ref));
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

function annotationDict(
  lib: PdfLib,
  document: PDFDocument,
  page: PDFPage,
  annotation: Annotation,
): PDFRef | null {
  const bounds = appearanceBounds(annotation);
  const content = appearanceStream(annotation);
  if (!bounds || content.length === 0) return null;

  const context = document.context;
  const resources = needsMultiply(annotation)
    ? { ExtGState: { GSMul: { Type: 'ExtGState', BM: 'Multiply' } } }
    : {};

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

  if (usesQuads(annotation.kind)) dictionary.QuadPoints = rounded(quadNumbers(annotation));
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

export async function writeAnnotations(
  bytes: Uint8Array,
  current: Annotation[],
  original: Annotation[],
): Promise<Uint8Array> {
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

  const pages = document.getPages();
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

  for (const annotation of toCreate(current, original)) {
    const page = pages[annotation.page - 1];
    if (!page) continue;
    const ref = annotationDict(lib, document, page, annotation);
    if (!ref) continue;

    const annots = page.node.Annots();
    if (annots) annots.push(ref);
    else page.node.set(lib.PDFName.of('Annots'), context.obj([ref]));
  }

  try {
    return await document.save({ useObjectStreams: false });
  } catch (error) {
    throw new PdfWriteError('broken', error instanceof Error ? error.message : String(error));
  }
}
