import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { makePdf, makePdfWithOutline } from '../../test/pdf-fixtures';
import { heightsForWidth, openPdfDocument, PdfOpenError, type PdfHandle } from './document';
import { loadPdfjs } from './load';

const open: PdfHandle[] = [];

async function openBytes(bytes: Uint8Array): Promise<PdfHandle> {
  const handle = await openPdfDocument(bytes);
  open.push(handle);
  return handle;
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

describe('openPdfDocument', () => {
  it('reports how many pages the document has', async () => {
    const handle = await openBytes(await makePdf([{ text: 'a' }, { text: 'b' }]));
    expect(handle.pageCount).toBe(2);
  });

  it('reports the size of every page', async () => {
    const handle = await openBytes(
      await makePdf([
        { text: 'a', width: 600, height: 800 },
        { text: 'b', width: 400, height: 400 },
      ]),
    );
    expect(handle.pageSizes[0]).toMatchObject({ width: 600, height: 800 });
    expect(handle.pageSizes[1]).toMatchObject({ width: 400, height: 400 });
  });

  it('leaves the bytes it was given untouched', async () => {
    const bytes = await makePdf([{ text: 'a' }]);
    await openBytes(bytes);
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(bytes[0]).toBe('%'.charCodeAt(0));
  });

  it('gives every page a rotation', async () => {
    const handle = await openBytes(await makePdf([{ text: 'a' }]));
    expect(handle.pageSizes[0]?.rotation).toBe(0);
  });

  it('hands back a page by its number', async () => {
    const handle = await openBytes(await makePdf([{ text: 'a' }, { text: 'b' }]));
    const page = await handle.page(2);
    expect(page.pageNumber).toBe(2);
  });

  it('clamps a page number past the end', async () => {
    const handle = await openBytes(await makePdf([{ text: 'a' }]));
    expect((await handle.page(99)).pageNumber).toBe(1);
  });

  it('clamps a page number below the first', async () => {
    const handle = await openBytes(await makePdf([{ text: 'a' }]));
    expect((await handle.page(0)).pageNumber).toBe(1);
  });

  it('returns an empty outline when the document has none', async () => {
    const handle = await openBytes(await makePdf([{ text: 'a' }]));
    expect(await handle.outline()).toEqual([]);
  });

  it('reads a nested outline with its page numbers', async () => {
    const handle = await openBytes(await makePdfWithOutline());
    const outline = await handle.outline();
    expect(outline.map((e) => e.title)).toEqual([
      'Capitulo uno',
      'Capitulo dos',
      'Subseccion',
    ]);
    expect(outline.map((e) => e.depth)).toEqual([0, 0, 1]);
    expect(outline.map((e) => e.page)).toEqual([1, 2, 3]);
  });

  it('refuses something that is not a pdf', async () => {
    const rubbish = new TextEncoder().encode('esto no es un pdf');
    await expect(openPdfDocument(rubbish)).rejects.toBeInstanceOf(PdfOpenError);
  });

  it('says why it refused', async () => {
    const rubbish = new TextEncoder().encode('esto no es un pdf');
    await expect(openPdfDocument(rubbish)).rejects.toMatchObject({ reason: 'corrupt' });
  });
});

describe('heightsForWidth', () => {
  it('keeps the aspect ratio of every page', () => {
    const sizes = [
      { width: 600, height: 800, rotation: 0 },
      { width: 400, height: 400, rotation: 0 },
    ];
    expect(heightsForWidth(sizes, 300)).toEqual([400, 300]);
  });

  it('returns zero for a page with no width', () => {
    expect(heightsForWidth([{ width: 0, height: 100, rotation: 0 }], 300)).toEqual([0]);
  });

  it('returns nothing for a document with no pages', () => {
    expect(heightsForWidth([], 300)).toEqual([]);
  });
});
