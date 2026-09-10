import { describe, expect, it } from 'vitest';
import { loadForWriting } from '../annotations/write';
import { applyTextEdits, readPageText, type TextEdit } from './document';

const CMAP = [
  '/CIDInit /ProcSet findresource begin',
  '12 dict begin',
  'begincmap',
  '4 beginbfchar',
  '<0024> <0041>',
  '<0025> <0042>',
  '<0026> <0043>',
  '<0027> <0044>',
  'endbfchar',
  'endcmap',
  'end',
].join('\n');

async function compositePdf(text = '0024002500260027'): Promise<Uint8Array> {
  const lib = await import('pdf-lib');
  const document = await lib.PDFDocument.create();
  const page = document.addPage([600, 800]);
  const context = document.context;

  const cmap = context.register(context.flateStream(CMAP, {}));

  const descendant = context.register(
    context.obj({
      Type: 'Font',
      Subtype: 'CIDFontType2',
      BaseFont: 'AAAAAA+Prueba',
      CIDSystemInfo: { Registry: lib.PDFString.of('Adobe'), Ordering: lib.PDFString.of('Identity'), Supplement: 0 },
      DW: 1000,
      W: [0x24, [500, 600, 700, 800]],
    }),
  );

  const font = context.register(
    context.obj({
      Type: 'Font',
      Subtype: 'Type0',
      BaseFont: 'AAAAAA+Prueba',
      Encoding: 'Identity-H',
      DescendantFonts: [descendant],
      ToUnicode: cmap,
    }),
  );

  const content = context.register(
    context.flateStream(`BT /F1 12 Tf 60 700 Td <${text}> Tj ET`, {}),
  );

  page.node.set(lib.PDFName.of('Contents'), content);
  page.node.set(
    lib.PDFName.of('Resources'),
    context.obj({ Font: { F1: font } }),
  );

  return document.save({ useObjectStreams: false });
}

describe('fuentes compuestas', () => {
  it('lee el texto de una fuente Identity-H', async () => {
    const document = await loadForWriting(await compositePdf());
    const text = await readPageText(document, 1);
    const run = text?.runs[0];
    const font = text?.fonts.get('F1');
    expect(font?.toUnicode(run?.bytes ?? '')).toBe('ABCD');
  });

  it('mide el texto con los anchos del descendiente', async () => {
    const document = await loadForWriting(await compositePdf());
    const text = await readPageText(document, 1);
    const run = text?.runs[0];
    expect(run?.measured).toBe(true);
    expect(run?.advance).toBeCloseTo(((500 + 600 + 700 + 800) / 1000) * 12, 5);
  });

  it('deja cambiar el texto por otro que use los mismos glifos', async () => {
    const bytes = await compositePdf();
    const document = await loadForWriting(bytes);
    const edit: TextEdit = {
      id: 'e1',
      page: 1,
      x: 60,
      y: 700,
      width: 31.2,
      height: 12,
      oldText: 'ABCD',
      newText: 'ABC',
    };
    const reports = await applyTextEdits(document, [edit]);
    expect(reports[0]?.done).toBe(true);
  });

  it('se niega cuando la letra nueva no esta en la fuente', async () => {
    const document = await loadForWriting(await compositePdf());
    const edit: TextEdit = {
      id: 'e1',
      page: 1,
      x: 60,
      y: 700,
      width: 31.2,
      height: 12,
      oldText: 'ABCD',
      newText: 'ABCZ',
    };
    const reports = await applyTextEdits(document, [edit]);
    expect(reports[0]?.done).toBe(false);
    expect(reports[0]?.reason).toBe('characters');
  });

  it('escribe el texto nuevo como cadena hexadecimal', async () => {
    const document = await loadForWriting(await compositePdf());
    const text = await readPageText(document, 1);
    const run = text?.runs[0];
    const font = text?.fonts.get('F1');
    const { buildReplacement } = await import('./replace');
    const outcome = buildReplacement(run!, 'AB', font ?? null);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.source).toContain('<00240025>');
  });
});
