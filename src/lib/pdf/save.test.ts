import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { makeFormPdf, makePdf } from '../../test/pdf-fixtures';
import { rectToQuad } from './annotations/geometry';
import type { Annotation } from './annotations/model';
import { readAnnotations } from './annotations/read';
import { PdfWriteError } from './annotations/write';
import { openPdfDocument, type PdfHandle } from './document';
import { loadPdfjs } from './load';
import { valuesOf } from './forms/model';
import { readFields } from './forms/read';
import { initialPlan, movePages, removePages, turnPages, type PageEdit } from './pages';
import { buildSavedPdf, extractPages } from './save';
import { extractPageText } from './search';

const open: PdfHandle[] = [];

function mark(page: number, extra: Partial<Annotation> = {}): Annotation {
  return {
    id: `a${page}`,
    page,
    kind: 'highlight',
    color: '#ffd400',
    opacity: 0.4,
    contents: `nota de ${page}`,
    author: 'Esteban',
    createdMs: Date.UTC(2024, 0, 2),
    origin: 'reader',
    quads: [rectToQuad({ x: 10, y: 700, width: 100, height: 12 })],
    ...extra,
  };
}

async function three(): Promise<Uint8Array> {
  return makePdf([{ text: 'UNO' }, { text: 'DOS' }, { text: 'TRES' }]);
}

async function reopen(bytes: Uint8Array): Promise<PdfHandle> {
  const handle = await openPdfDocument(bytes);
  open.push(handle);
  return handle;
}

async function order(handle: PdfHandle): Promise<string[]> {
  const words: string[] = [];
  for (let page = 1; page <= handle.pageCount; page += 1) {
    words.push((await extractPageText(handle, page)).trim());
  }
  return words;
}

async function save(
  bytes: Uint8Array,
  pages: PageEdit[],
  savedPages: PageEdit[],
  annotations: Annotation[] = [],
  savedAnnotations: Annotation[] = [],
): Promise<Uint8Array> {
  return buildSavedPdf({ bytes, pages, savedPages, annotations, savedAnnotations });
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

describe('buildSavedPdf', () => {
  it('leaves the document as it was when nothing changed', async () => {
    const bytes = await three();
    const handle = await reopen(await save(bytes, initialPlan(3), initialPlan(3)));
    expect(await order(handle)).toEqual(['UNO', 'DOS', 'TRES']);
  });

  it('moves a page to another place', async () => {
    const bytes = await three();
    const plan = movePages(initialPlan(3), [0], 3);
    const handle = await reopen(await save(bytes, plan, initialPlan(3)));
    expect(await order(handle)).toEqual(['DOS', 'TRES', 'UNO']);
  });

  it('removes a page', async () => {
    const bytes = await three();
    const plan = removePages(initialPlan(3), [1]);
    const handle = await reopen(await save(bytes, plan, initialPlan(3)));
    expect(handle.pageCount).toBe(2);
    expect(await order(handle)).toEqual(['UNO', 'TRES']);
  });

  it('turns a page inside the file', async () => {
    const bytes = await three();
    const plan = turnPages(initialPlan(3), [1], 1);
    const handle = await reopen(await save(bytes, plan, initialPlan(3)));
    expect(handle.pageSizes[1]?.rotation).toBe(90);
    expect(handle.pageSizes[0]?.rotation).toBe(0);
  });

  it('adds the turn to the one the page already had', async () => {
    const bytes = await three();
    const once = await save(bytes, turnPages(initialPlan(3), [0], 1), initialPlan(3));
    const twice = await save(once, turnPages(initialPlan(3), [0], 1), initialPlan(3));
    expect((await reopen(twice)).pageSizes[0]?.rotation).toBe(180);
  });

  it('keeps the size of a page it turns', async () => {
    const bytes = await makePdf([{ text: 'UNO', width: 400, height: 800 }]);
    const handle = await reopen(
      await save(bytes, turnPages(initialPlan(1), [0], 1), initialPlan(1)),
    );
    expect(handle.pageSizes[0]).toMatchObject({ width: 400, height: 800, rotation: 90 });
  });

  it('takes the annotations of a page with it when the page moves', async () => {
    const bytes = await three();
    const written = await save(bytes, initialPlan(3), initialPlan(3), [mark(1)], []);
    const moved = await save(written, movePages(initialPlan(3), [0], 3), initialPlan(3));

    const handle = await reopen(moved);
    const found = await readAnnotations(handle);
    expect(await order(handle)).toEqual(['DOS', 'TRES', 'UNO']);
    expect(found).toHaveLength(1);
    expect(found[0]?.page).toBe(3);
  });

  it('writes a new annotation on the page it was drawn on, wherever it ends up', async () => {
    const bytes = await three();
    const plan = movePages(initialPlan(3), [0], 3);
    const written = await save(bytes, plan, initialPlan(3), [mark(1)], []);

    const handle = await reopen(written);
    const found = await readAnnotations(handle);
    expect(found[0]?.page).toBe(3);
    expect(found[0]?.contents).toBe('nota de 1');
  });

  it('loses the annotations of a page that is removed, and only those', async () => {
    const bytes = await three();
    const written = await save(bytes, initialPlan(3), initialPlan(3), [mark(1), mark(3)], []);
    const trimmed = await save(written, removePages(initialPlan(3), [0]), initialPlan(3));

    const found = await readAnnotations(await reopen(trimmed));
    expect(found).toHaveLength(1);
    expect(found[0]?.contents).toBe('nota de 3');
  });

  it('does not write an annotation twice when the pages moved', async () => {
    const bytes = await three();
    const first = await save(bytes, initialPlan(3), initialPlan(3), [mark(2)], []);
    const inFile = await readAnnotations(await reopen(first));

    const moved = await save(first, movePages(initialPlan(3), [2], 0), initialPlan(3), inFile, inFile);
    expect(await readAnnotations(await reopen(moved))).toHaveLength(1);
  });

  it('refuses a plan with no pages', async () => {
    const bytes = await three();
    await expect(save(bytes, [], initialPlan(3))).rejects.toBeInstanceOf(PdfWriteError);
  });

  it('ignores a plan that points at a page that is not there', async () => {
    const bytes = await three();
    const plan: PageEdit[] = [
      { source: 2, rotation: 0 },
      { source: 9, rotation: 0 },
    ];
    const handle = await reopen(await save(bytes, plan, initialPlan(3)));
    expect(await order(handle)).toEqual(['DOS']);
  });
});

describe('forms and pages together', () => {
  it('fills a field and turns its page in the same save', async () => {
    const bytes = await makeFormPdf();
    const fields = await readFields(await reopen(bytes));
    const written = await buildSavedPdf({
      bytes,
      pages: turnPages(initialPlan(1), [0], 1),
      savedPages: initialPlan(1),
      annotations: [],
      savedAnnotations: [],
      fields,
      fieldValues: { ...valuesOf(fields), 'persona.nombre': 'Esteban' },
      savedFieldValues: valuesOf(fields),
    });

    const handle = await reopen(written);
    expect(handle.pageSizes[0]?.rotation).toBe(90);
    const after = await readFields(handle);
    expect(after.find((f) => f.name === 'persona.nombre')?.value).toBe('Esteban');
  });

  it('leaves the form alone when no value changed', async () => {
    const bytes = await makeFormPdf();
    const fields = await readFields(await reopen(bytes));
    const written = await buildSavedPdf({
      bytes,
      pages: initialPlan(1),
      savedPages: initialPlan(1),
      annotations: [],
      savedAnnotations: [],
      fields,
      fieldValues: valuesOf(fields),
      savedFieldValues: valuesOf(fields),
    });
    const after = await readFields(await reopen(written));
    expect(after).toHaveLength(fields.length);
  });
});

describe('extractPages', () => {
  it('makes a document with only the pages asked for', async () => {
    const handle = await reopen(await extractPages(await three(), [3, 1]));
    expect(await order(handle)).toEqual(['TRES', 'UNO']);
  });

  it('takes the annotations of those pages with them', async () => {
    const bytes = await save(await three(), initialPlan(3), initialPlan(3), [mark(2)], []);
    const found = await readAnnotations(await reopen(await extractPages(bytes, [2])));
    expect(found).toHaveLength(1);
    expect(found[0]?.page).toBe(1);
  });

  it('leaves out a page that is not there', async () => {
    const handle = await reopen(await extractPages(await three(), [1, 99]));
    expect(handle.pageCount).toBe(1);
  });

  it('complains when nothing can be extracted', async () => {
    await expect(extractPages(await three(), [99])).rejects.toBeInstanceOf(PdfWriteError);
  });
});
