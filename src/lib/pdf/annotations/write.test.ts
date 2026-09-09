import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { makeAnnotatedPdf, makePdf } from '../../../test/pdf-fixtures';
import { openPdfDocument, type PdfHandle } from '../document';
import { loadPdfjs } from '../load';
import { rectToQuad } from './geometry';
import { annotationKey, type Annotation, type AnnotationKind } from './model';
import { readAnnotations } from './read';
import { PdfWriteError, staleRefs, toCreate, writeAnnotations } from './write';

function annotation(kind: AnnotationKind, extra: Partial<Annotation> = {}): Annotation {
  return {
    id: `a-${kind}`,
    page: 1,
    kind,
    color: '#ffd400',
    opacity: 1,
    contents: '',
    author: 'Esteban',
    createdMs: Date.UTC(2024, 0, 2, 3, 4, 5),
    origin: 'reader',
    ...extra,
  };
}

const HIGHLIGHT = annotation('highlight', {
  quads: [rectToQuad({ x: 10, y: 700, width: 100, height: 12 })],
  opacity: 0.4,
  contents: 'una nota',
});

describe('staleRefs', () => {
  const fromFile = annotation('highlight', { ref: '12R', origin: 'file', quads: HIGHLIGHT.quads });

  it('leaves an untouched annotation alone', () => {
    expect(staleRefs([fromFile], [fromFile]).size).toBe(0);
  });

  it('marks one that was deleted', () => {
    expect([...staleRefs([], [fromFile])]).toEqual(['12R']);
  });

  it('marks one that changed', () => {
    const edited = { ...fromFile, color: '#ff0000' };
    expect([...staleRefs([edited], [fromFile])]).toEqual(['12R']);
  });

  it('ignores annotations that were never in the file', () => {
    expect(staleRefs([HIGHLIGHT], []).size).toBe(0);
  });
});

describe('toCreate', () => {
  const fromFile = annotation('highlight', { ref: '12R', origin: 'file', quads: HIGHLIGHT.quads });

  it('writes a new annotation', () => {
    expect(toCreate([HIGHLIGHT], [])).toEqual([HIGHLIGHT]);
  });

  it('does not write again one that has not changed', () => {
    expect(toCreate([fromFile], [fromFile])).toEqual([]);
  });

  it('writes again one that changed', () => {
    const edited = { ...fromFile, color: '#ff0000' };
    expect(toCreate([edited], [fromFile])).toEqual([edited]);
  });
});

describe('writeAnnotations', () => {
  const open: PdfHandle[] = [];

  beforeAll(async () => {
    const pdfjs = await loadPdfjs();
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'),
    ).href;
  });

  afterEach(async () => {
    while (open.length > 0) await open.pop()?.destroy().catch(() => undefined);
  });

  async function reopen(bytes: Uint8Array): Promise<PdfHandle> {
    const handle = await openPdfDocument(bytes);
    open.push(handle);
    return handle;
  }

  async function roundTrip(
    bytes: Uint8Array,
    current: Annotation[],
    original: Annotation[] = [],
  ): Promise<Annotation[]> {
    const written = await writeAnnotations(bytes, current, original);
    return readAnnotations(await reopen(written));
  }

  it('writes a highlight that any reader can find', async () => {
    const [read] = await roundTrip(await makePdf([{ text: 'a' }]), [HIGHLIGHT]);
    expect(read?.kind).toBe('highlight');
    expect(read?.page).toBe(1);
    expect(read?.color).toBe('#ffd400');
    expect(read?.contents).toBe('una nota');
    expect(read?.author).toBe('Esteban');
    expect(read?.opacity).toBeCloseTo(0.4, 2);
  });

  it('keeps the geometry of a highlight to the hundredth of a point', async () => {
    const [read] = await roundTrip(await makePdf([{ text: 'a' }]), [HIGHLIGHT]);
    expect(read?.quads?.[0]).toEqual(HIGHLIGHT.quads![0]);
  });

  it('keeps a colour that is not a round number', async () => {
    const read = await roundTrip(await makePdf([{ text: 'a' }]), [
      { ...HIGHLIGHT, color: '#4dabf7' },
      { ...HIGHLIGHT, id: 'b', color: '#b197fc' },
    ]);
    expect(read.map((annotation) => annotation.color).sort()).toEqual(['#4dabf7', '#b197fc']);
  });

  it('keeps the date the annotation was made', async () => {
    const [read] = await roundTrip(await makePdf([{ text: 'a' }]), [HIGHLIGHT]);
    expect(read?.createdMs).toBe(Date.UTC(2024, 0, 2, 3, 4, 5));
  });

  it('gives the annotation a drawing of its own', async () => {
    const written = await writeAnnotations(await makePdf([{ text: 'a' }]), [HIGHLIGHT], []);
    const handle = await reopen(written);
    const raw = (await (await handle.page(1)).getAnnotations({ intent: 'display' })) as Array<{
      hasAppearance?: boolean;
    }>;
    expect(raw[0]?.hasAppearance).toBe(true);
  });

  it('writes an underline', async () => {
    const [read] = await roundTrip(await makePdf([{ text: 'a' }]), [
      annotation('underline', { quads: HIGHLIGHT.quads }),
    ]);
    expect(read?.kind).toBe('underline');
  });

  it('writes a strikeout', async () => {
    const [read] = await roundTrip(await makePdf([{ text: 'a' }]), [
      annotation('strikeout', { quads: HIGHLIGHT.quads }),
    ]);
    expect(read?.kind).toBe('strikeout');
  });

  it('writes a drawing with its strokes', async () => {
    const ink = annotation('ink', {
      ink: [
        [
          { x: 10, y: 10 },
          { x: 30, y: 40 },
          { x: 50, y: 20 },
        ],
      ],
    });
    const [read] = await roundTrip(await makePdf([{ text: 'a' }]), [ink]);
    expect(read?.kind).toBe('ink');
    expect(read?.ink?.[0]).toEqual(ink.ink![0]);
  });

  it('writes a note with its text', async () => {
    const [read] = await roundTrip(await makePdf([{ text: 'a' }]), [
      annotation('note', { rect: { x: 10, y: 700, width: 22, height: 22 }, contents: 'ojo' }),
    ]);
    expect(read?.kind).toBe('note');
    expect(read?.contents).toBe('ojo');
  });

  it('writes a rectangle', async () => {
    const [read] = await roundTrip(await makePdf([{ text: 'a' }]), [
      annotation('rect', { rect: { x: 10, y: 10, width: 100, height: 50 } }),
    ]);
    expect(read?.kind).toBe('rect');
    expect(read?.rect?.width).toBeCloseTo(100 + 1.5 * 2, 1);
  });

  it('writes an ellipse', async () => {
    const [read] = await roundTrip(await makePdf([{ text: 'a' }]), [
      annotation('ellipse', { rect: { x: 10, y: 10, width: 100, height: 50 } }),
    ]);
    expect(read?.kind).toBe('ellipse');
  });

  it('writes it on the page it belongs to', async () => {
    const [read] = await roundTrip(await makePdf([{ text: 'a' }, { text: 'b' }]), [
      { ...HIGHLIGHT, page: 2 },
    ]);
    expect(read?.page).toBe(2);
  });

  it('writes several annotations at once', async () => {
    const read = await roundTrip(await makePdf([{ text: 'a' }]), [
      HIGHLIGHT,
      annotation('rect', { id: 'b', rect: { x: 10, y: 10, width: 50, height: 50 } }),
    ]);
    expect(read).toHaveLength(2);
  });

  it('leaves alone an annotation Reader does not understand', async () => {
    const bytes = await makeAnnotatedPdf([{ subtype: 'Link', rect: [10, 10, 110, 60] }]);
    const written = await writeAnnotations(bytes, [HIGHLIGHT], []);
    const handle = await reopen(written);
    const raw = (await (await handle.page(1)).getAnnotations({ intent: 'display' })) as Array<{
      annotationType?: number;
    }>;
    expect(raw).toHaveLength(2);
    expect(raw.some((entry) => entry.annotationType === 2)).toBe(true);
  });

  it('does not write again the annotations that were already there', async () => {
    const bytes = await makeAnnotatedPdf([
      {
        subtype: 'Highlight',
        rect: [10, 700, 110, 712],
        quadPoints: [10, 712, 110, 712, 10, 700, 110, 700],
        color: [1, 0.83, 0],
      },
    ]);
    const original = await readAnnotations(await reopen(bytes));
    const read = await roundTrip(bytes, original, original);
    expect(read).toHaveLength(1);
    expect(annotationKey(read[0]!)).toBe(annotationKey(original[0]!));
  });

  it('removes one that the reader deleted', async () => {
    const bytes = await makeAnnotatedPdf([
      {
        subtype: 'Highlight',
        rect: [10, 700, 110, 712],
        quadPoints: [10, 712, 110, 712, 10, 700, 110, 700],
      },
    ]);
    const original = await readAnnotations(await reopen(bytes));
    expect(await roundTrip(bytes, [], original)).toEqual([]);
  });

  it('replaces one that the reader changed', async () => {
    const bytes = await makeAnnotatedPdf([
      {
        subtype: 'Highlight',
        rect: [10, 700, 110, 712],
        quadPoints: [10, 712, 110, 712, 10, 700, 110, 700],
        color: [1, 0.83, 0],
      },
    ]);
    const original = await readAnnotations(await reopen(bytes));
    const edited = [{ ...original[0]!, color: '#ff0000' }];
    const read = await roundTrip(bytes, edited, original);
    expect(read).toHaveLength(1);
    expect(read[0]?.color).toBe('#ff0000');
  });

  it('keeps the pages the document had', async () => {
    const written = await writeAnnotations(
      await makePdf([{ text: 'a' }, { text: 'b' }, { text: 'c' }]),
      [HIGHLIGHT],
      [],
    );
    expect((await reopen(written)).pageCount).toBe(3);
  });

  it('leaves out an annotation with no geometry', async () => {
    expect(await roundTrip(await makePdf([{ text: 'a' }]), [annotation('highlight')])).toEqual([]);
  });

  it('complains about a file that is not a pdf', async () => {
    await expect(writeAnnotations(new Uint8Array([1, 2, 3]), [HIGHLIGHT], [])).rejects.toBeInstanceOf(
      PdfWriteError,
    );
  });
});
