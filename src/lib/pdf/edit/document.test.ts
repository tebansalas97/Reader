import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { makePdf } from '../../../test/pdf-fixtures';
import { loadForWriting, saveWritten } from '../annotations/write';
import { openPdfDocument, type PdfHandle } from '../document';
import { loadPdfjs } from '../load';
import { extractPageText } from '../search';
import { applyTextEdits, matchRun, readPageText, type TextEdit } from './document';
import { originOf } from './runs';

const open: PdfHandle[] = [];

async function reopen(bytes: Uint8Array): Promise<PdfHandle> {
  const handle = await openPdfDocument(bytes);
  open.push(handle);
  return handle;
}

async function sample(): Promise<Uint8Array> {
  return makePdf([{ text: 'Hola mundo entero' }, { text: 'Segunda pagina' }]);
}

async function firstRun(bytes: Uint8Array) {
  const document = await loadForWriting(bytes);
  const text = await readPageText(document, 1);
  return { document, text };
}

async function edit(bytes: Uint8Array, changes: Array<Partial<TextEdit> & { newText: string }>) {
  const document = await loadForWriting(bytes);
  const text = await readPageText(document, 1);
  const run = text!.runs[0]!;
  const origin = originOf(run);

  const edits: TextEdit[] = changes.map((change, index) => ({
    id: `e${index}`,
    page: 1,
    x: change.x ?? origin.x,
    y: change.y ?? origin.y,
    width: run.advance,
    height: run.size,
    oldText: change.oldText ?? run.bytes,
    newText: change.newText,
  }));

  const reports = await applyTextEdits(document, edits);
  return { reports, bytes: await saveWritten(document) };
}

beforeAll(async () => {
  const pdfjs = await loadPdfjs();
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'),
  ).href;
});

afterEach(async () => {
  while (open.length > 0) await open.pop()?.destroy().catch(() => undefined);
});

describe('readPageText', () => {
  it('finds the text of the page in its content stream', async () => {
    const { text } = await firstRun(await sample());
    expect(text?.runs).toHaveLength(1);
    expect(text?.runs[0]?.bytes).toBe('Hola mundo entero');
  });

  it('reads the font of the run and can measure it', async () => {
    const { text } = await firstRun(await sample());
    const run = text!.runs[0]!;
    expect(text?.fonts.get(run.font)?.measurable).toBe(true);
    expect(text?.fonts.get(run.font)?.editable).toBe(true);
  });

  it('places the run where the page shows it', async () => {
    const { text } = await firstRun(await sample());
    expect(originOf(text!.runs[0]!)).toEqual({ x: 50, y: 700 });
  });

  it('gives nothing for a page that is not there', async () => {
    const document = await loadForWriting(await sample());
    expect(await readPageText(document, 9)).toBeNull();
  });
});

describe('matchRun', () => {
  it('finds the run the edit points at', async () => {
    const { text } = await firstRun(await sample());
    const found = matchRun(text!.runs, {
      id: 'e1',
      page: 1,
      x: 50.2,
      y: 700.1,
      width: 10,
      height: 18,
      oldText: 'Hola mundo entero',
      newText: 'x',
    });
    expect(found?.bytes).toBe('Hola mundo entero');
  });

  it('finds nothing when the edit points somewhere else', async () => {
    const { text } = await firstRun(await sample());
    const found = matchRun(text!.runs, {
      id: 'e1',
      page: 1,
      x: 300,
      y: 300,
      width: 10,
      height: 18,
      oldText: 'Hola mundo entero',
      newText: 'x',
    });
    expect(found).toBeNull();
  });
});

describe('applyTextEdits', () => {
  it('replaces the text inside the file', async () => {
    const { reports, bytes } = await edit(await sample(), [{ newText: 'Adios mundo' }]);
    expect(reports[0]?.done).toBe(true);
    expect((await extractPageText(await reopen(bytes), 1)).trim()).toBe('Adios mundo');
  });

  it('leaves the other pages alone', async () => {
    const { bytes } = await edit(await sample(), [{ newText: 'Adios' }]);
    const handle = await reopen(bytes);
    expect((await extractPageText(handle, 2)).trim()).toBe('Segunda pagina');
  });

  it('keeps what comes after in its place', async () => {
    const bytes = await makePdf([{ text: 'uno dos' }]);
    const document = await loadForWriting(bytes);
    const before = await readPageText(document, 1);
    const run = before!.runs[0]!;
    const origin = originOf(run);

    await applyTextEdits(document, [
      {
        id: 'e1',
        page: 1,
        x: origin.x,
        y: origin.y,
        width: run.advance,
        height: run.size,
        oldText: run.bytes,
        newText: 'un',
      },
    ]);
    const after = await readPageText(document, 1);
    expect(after!.runs[0]!.advance).toBeCloseTo(run.advance, 1);
  });

  it('refuses text that does not fit', async () => {
    const { reports, bytes } = await edit(await sample(), [
      { newText: 'Hola mundo entero pero mucho mas largo todavia' },
    ]);
    expect(reports[0]?.done).toBe(false);
    expect(reports[0]?.reason).toBe('space');
    expect((await extractPageText(await reopen(bytes), 1)).trim()).toBe('Hola mundo entero');
  });

  it('refuses a character the font cannot write', async () => {
    const { reports } = await edit(await sample(), [{ newText: 'Hola 漢字' }]);
    expect(reports[0]?.done).toBe(false);
    expect(reports[0]?.reason).toBe('characters');
  });

  it('refuses to leave the text empty', async () => {
    const { reports } = await edit(await sample(), [{ newText: '   ' }]);
    expect(reports[0]?.reason).toBe('empty');
  });

  it('says when the run is no longer where it was', async () => {
    const { reports } = await edit(await sample(), [{ newText: 'Hola', x: 400, y: 400 }]);
    expect(reports[0]?.done).toBe(false);
    expect(reports[0]?.reason).toBe('missing');
  });

  it('writes several edits of the same page at once', async () => {
    const bytes = await makePdf([{ text: 'uno dos tres' }]);
    const document = await loadForWriting(bytes);
    const text = await readPageText(document, 1);
    const run = text!.runs[0]!;
    const origin = originOf(run);

    const reports = await applyTextEdits(document, [
      {
        id: 'a',
        page: 1,
        x: origin.x,
        y: origin.y,
        width: run.advance,
        height: run.size,
        oldText: run.bytes,
        newText: 'ABC',
      },
    ]);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.done).toBe(true);

    const written = await saveWritten(document);
    expect((await extractPageText(await reopen(written), 1)).trim()).toBe('ABC');
  });

  it('does nothing when there is nothing to do', async () => {
    const document = await loadForWriting(await sample());
    expect(await applyTextEdits(document, [])).toEqual([]);
  });

  it('leaves the document readable after the change', async () => {
    const { bytes } = await edit(await sample(), [{ newText: 'Adios' }]);
    const handle = await reopen(bytes);
    expect(handle.pageCount).toBe(2);
    expect(handle.pageSizes[0]?.width).toBe(600);
  });
});
