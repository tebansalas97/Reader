import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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
