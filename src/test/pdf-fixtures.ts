import { degrees, PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PdfLiteral } from '../lib/pdf/annotations/write';

export interface FixturePage {
  text: string;
  width?: number;
  height?: number;
}

export async function makePdf(pages: FixturePage[]): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const spec of pages) {
    const page = document.addPage([spec.width ?? 600, spec.height ?? 800]);
    page.drawText(spec.text, {
      x: 50,
      y: (spec.height ?? 800) - 100,
      size: 18,
      font,
      color: rgb(0, 0, 0),
    });
  }
  return document.save();
}

export async function makeRotatedPdf(rotation: number): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage([600, 800]);
  page.setRotation(degrees(rotation));
  return document.save();
}

export async function makeOffsetPdf(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage([600, 800]);
  page.setMediaBox(20, 40, 600, 800);
  return document.save();
}

function setKey(target: unknown, key: unknown, value: unknown): void {
  (target as { set(k: unknown, v: unknown): void }).set(key, value);
}

export async function makePdfWithOutline(): Promise<Uint8Array> {
  const bytes = await makePdf([{ text: 'Primera' }, { text: 'Segunda' }, { text: 'Tercera' }]);
  const document = await PDFDocument.load(bytes);
  const context = document.context;
  const pages = document.getPages();
  const { PDFName, PDFNumber, PDFHexString } = await import('pdf-lib');

  const child = context.obj({
    Title: PDFHexString.fromText('Subseccion'),
    Dest: [pages[2]!.ref, PDFName.of('Fit')],
  });
  const childRef = context.register(child);

  const second = context.obj({
    Title: PDFHexString.fromText('Capitulo dos'),
    Dest: [pages[1]!.ref, PDFName.of('Fit')],
    First: childRef,
    Last: childRef,
    Count: PDFNumber.of(1),
  });
  const secondRef = context.register(second);

  const first = context.obj({
    Title: PDFHexString.fromText('Capitulo uno'),
    Dest: [pages[0]!.ref, PDFName.of('Fit')],
    Next: secondRef,
  });
  const firstRef = context.register(first);

  const outlines = context.obj({
    Type: 'Outlines',
    First: firstRef,
    Last: secondRef,
    Count: PDFNumber.of(2),
  });
  const outlinesRef = context.register(outlines);

  setKey(second, PDFName.of('Prev'), firstRef);
  setKey(child, PDFName.of('Parent'), secondRef);
  setKey(first, PDFName.of('Parent'), outlinesRef);
  setKey(second, PDFName.of('Parent'), outlinesRef);
  document.catalog.set(PDFName.of('Outlines'), outlinesRef);

  return document.save();
}

export interface FixtureAnnotation {
  subtype: string;
  rect: [number, number, number, number];
  quadPoints?: number[];
  inkList?: number[][];
  color?: [number, number, number];
  opacity?: number;
  contents?: string;
  author?: string;
  created?: string;
}

export async function makeAnnotatedPdf(annotations: FixtureAnnotation[]): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage([600, 800]);
  const context = document.context;
  const { PDFHexString, PDFName, PDFString } = await import('pdf-lib');

  const refs = annotations.map((spec) => {
    const dictionary: Record<string, PdfLiteral> = {
      Type: 'Annot',
      Subtype: spec.subtype,
      Rect: spec.rect,
      F: 4,
    };
    if (spec.quadPoints) dictionary.QuadPoints = spec.quadPoints;
    if (spec.inkList) dictionary.InkList = spec.inkList;
    if (spec.color) dictionary.C = spec.color;
    if (spec.opacity !== undefined) dictionary.CA = spec.opacity;
    if (spec.contents !== undefined) dictionary.Contents = PDFHexString.fromText(spec.contents);
    if (spec.author !== undefined) dictionary.T = PDFHexString.fromText(spec.author);
    if (spec.created !== undefined) dictionary.CreationDate = PDFString.of(spec.created);
    return context.register(context.obj(dictionary));
  });

  page.node.set(PDFName.of('Annots'), context.obj(refs));
  return document.save();
}
