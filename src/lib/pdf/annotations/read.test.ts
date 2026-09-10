import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { makeAnnotatedPdf } from '../../../test/pdf-fixtures';
import { openPdfDocument, type PdfHandle } from '../document';
import { loadPdfjs } from '../load';
import type { Annotation } from './model';
import {
  annotationFrom,
  colorOf,
  DEFAULT_COLOR,
  inkOf,
  kindOf,
  parsePdfDate,
  quadsOf,
  readAnnotations,
  rectOf,
  refKeyOf,
} from './read';

describe('kindOf', () => {
  it('reads a highlight', () => {
    expect(kindOf(9)).toBe('highlight');
  });

  it('reads every kind Reader understands', () => {
    expect([1, 5, 6, 9, 10, 12, 15].map(kindOf)).toEqual([
      'note',
      'rect',
      'ellipse',
      'highlight',
      'underline',
      'strikeout',
      'ink',
    ]);
  });

  it('leaves a form field alone', () => {
    expect(kindOf(20)).toBeNull();
  });

  it('leaves a link alone', () => {
    expect(kindOf(2)).toBeNull();
  });

  it('ignores a type that is not a number', () => {
    expect(kindOf('Highlight')).toBeNull();
  });
});

describe('colorOf', () => {
  it('writes the colour as hex', () => {
    expect(colorOf(new Uint8ClampedArray([255, 212, 0]))).toBe('#ffd400');
  });

  it('pads a channel below sixteen', () => {
    expect(colorOf([1, 2, 3])).toBe('#010203');
  });

  it('falls back for an annotation with no colour', () => {
    expect(colorOf(null)).toBe(DEFAULT_COLOR);
  });

  it('falls back for a colour that is not made of numbers', () => {
    expect(colorOf(['a', 'b', 'c'])).toBe(DEFAULT_COLOR);
  });
});

describe('refKeyOf', () => {
  it('keeps the reference pdf.js gives', () => {
    expect(refKeyOf('12R')).toBe('12R');
  });

  it('keeps a reference with a generation', () => {
    expect(refKeyOf('12R3')).toBe('12R3');
  });

  it('refuses something that is not a reference', () => {
    expect(refKeyOf('pdfjs_internal_id_12')).toBeNull();
  });
});

describe('parsePdfDate', () => {
  it('reads a full date', () => {
    expect(parsePdfDate('D:20240102030405Z')).toBe(Date.UTC(2024, 0, 2, 3, 4, 5));
  });

  it('reads a date with only the year', () => {
    expect(parsePdfDate('D:2024')).toBe(Date.UTC(2024, 0, 1));
  });

  it('moves a date with a positive offset back to utc', () => {
    expect(parsePdfDate("D:20240102030405+02'00'")).toBe(Date.UTC(2024, 0, 2, 1, 4, 5));
  });

  it('moves a date with a negative offset forward', () => {
    expect(parsePdfDate("D:20240102030405-05'00'")).toBe(Date.UTC(2024, 0, 2, 8, 4, 5));
  });

  it('gives nothing for a date that is not one', () => {
    expect(parsePdfDate('ayer')).toBe(0);
  });

  it('gives nothing when there is no date', () => {
    expect(parsePdfDate(undefined)).toBe(0);
  });
});

describe('quadsOf', () => {
  it('reads one quad from eight numbers', () => {
    expect(quadsOf(new Float32Array([0, 10, 20, 10, 0, 0, 20, 0]))).toEqual([
      { x1: 0, y1: 10, x2: 20, y2: 10, x3: 0, y3: 0, x4: 20, y4: 0 },
    ]);
  });

  it('reads two quads from sixteen numbers', () => {
    expect(quadsOf(new Array(16).fill(1))).toHaveLength(2);
  });

  it('ignores a tail that does not complete a quad', () => {
    expect(quadsOf(new Array(12).fill(1))).toHaveLength(1);
  });

  it('reads the shape older versions of pdf.js used', () => {
    const points = [
      { x: 0, y: 10 },
      { x: 20, y: 10 },
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ];
    expect(quadsOf(points)[0]?.x2).toBe(20);
  });

  it('gives nothing for an annotation with no quads', () => {
    expect(quadsOf(undefined)).toEqual([]);
  });
});

describe('inkOf', () => {
  it('reads a stroke of two points', () => {
    expect(inkOf([[1, 2, 3, 4]])).toEqual([
      [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
    ]);
  });

  it('reads several strokes', () => {
    expect(inkOf([[1, 2], [3, 4]])).toHaveLength(2);
  });

  it('drops an empty stroke', () => {
    expect(inkOf([[], [1, 2]])).toHaveLength(1);
  });

  it('gives nothing for an annotation with no strokes', () => {
    expect(inkOf(null)).toEqual([]);
  });
});

describe('rectOf', () => {
  it('turns the two corners into a box', () => {
    expect(rectOf([10, 20, 110, 60])).toEqual({ x: 10, y: 20, width: 100, height: 40 });
  });

  it('sorts the corners that come the wrong way round', () => {
    expect(rectOf([110, 60, 10, 20])).toEqual({ x: 10, y: 20, width: 100, height: 40 });
  });

  it('gives nothing for a box with too few numbers', () => {
    expect(rectOf([10, 20])).toBeNull();
  });
});

describe('annotationFrom', () => {
  const highlight = {
    annotationType: 9,
    id: '12R',
    rect: [10, 700, 110, 712],
    quadPoints: [10, 712, 110, 712, 10, 700, 110, 700],
    color: new Uint8ClampedArray([255, 212, 0]),
    opacity: 0.4,
    contentsObj: { str: 'una nota' },
    titleObj: { str: 'Esteban' },
    creationDate: 'D:20240102030405Z',
  };

  it('keeps the reference of the annotation in the file', () => {
    expect(annotationFrom(highlight, 3)?.ref).toBe('12R');
  });

  it('says it came from the file', () => {
    expect(annotationFrom(highlight, 3)?.origin).toBe('file');
  });

  it('keeps the page it is on', () => {
    expect(annotationFrom(highlight, 3)?.page).toBe(3);
  });

  it('keeps the text and the author', () => {
    const annotation = annotationFrom(highlight, 1)!;
    expect(annotation.contents).toBe('una nota');
    expect(annotation.author).toBe('Esteban');
  });

  it('keeps the transparency', () => {
    expect(annotationFrom(highlight, 1)?.opacity).toBe(0.4);
  });

  it('assumes it is opaque when the file says nothing', () => {
    expect(annotationFrom({ ...highlight, opacity: undefined }, 1)?.opacity).toBe(1);
  });

  it('falls back to the box when a highlight has no quads', () => {
    const annotation = annotationFrom({ ...highlight, quadPoints: undefined }, 1)!;
    expect(annotation.quads).toHaveLength(1);
    expect(annotation.quads?.[0]?.x2).toBe(110);
  });

  it('drops a kind Reader does not understand', () => {
    expect(annotationFrom({ ...highlight, annotationType: 20 }, 1)).toBeNull();
  });

  it('drops an annotation with no reference', () => {
    expect(annotationFrom({ ...highlight, id: 'x' }, 1)).toBeNull();
  });

  it('drops a note with no box', () => {
    expect(annotationFrom({ annotationType: 1, id: '2R' }, 1)).toBeNull();
  });

  it('drops a drawing with no strokes', () => {
    expect(annotationFrom({ annotationType: 15, id: '2R', rect: [0, 0, 1, 1] }, 1)).toBeNull();
  });

  it('gives every annotation its own identifier', () => {
    const one = annotationFrom(highlight, 1)!;
    const two = annotationFrom(highlight, 1)!;
    expect(one.id).not.toBe(two.id);
  });
});

describe('readAnnotations', () => {
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

  async function read(bytes: Uint8Array): Promise<Annotation[]> {
    const handle = await openPdfDocument(bytes);
    open.push(handle);
    return readAnnotations(handle);
  }

  it('reads a highlight written into the file', async () => {
    const [annotation] = await read(
      await makeAnnotatedPdf([
        {
          subtype: 'Highlight',
          rect: [10, 700, 110, 712],
          quadPoints: [10, 712, 110, 712, 10, 700, 110, 700],
          color: [1, 0.83, 0],
          opacity: 0.4,
          contents: 'hola',
          author: 'Esteban',
          created: 'D:20240102030405Z',
        },
      ]),
    );
    expect(annotation?.kind).toBe('highlight');
    expect(annotation?.contents).toBe('hola');
    expect(annotation?.author).toBe('Esteban');
    expect(annotation?.opacity).toBeCloseTo(0.4, 5);
    expect(annotation?.quads?.[0]).toEqual({
      x1: 10,
      y1: 712,
      x2: 110,
      y2: 712,
      x3: 10,
      y3: 700,
      x4: 110,
      y4: 700,
    });
  });

  it('reads the colour of a highlight', async () => {
    const [annotation] = await read(
      await makeAnnotatedPdf([
        {
          subtype: 'Highlight',
          rect: [10, 700, 110, 712],
          quadPoints: [10, 712, 110, 712, 10, 700, 110, 700],
          color: [1, 0, 0],
        },
      ]),
    );
    expect(annotation?.color).toBe('#ff0000');
  });

  it('reads a drawing', async () => {
    const [annotation] = await read(
      await makeAnnotatedPdf([
        {
          subtype: 'Ink',
          rect: [0, 0, 100, 100],
          inkList: [[10, 10, 20, 30, 40, 50]],
        },
      ]),
    );
    expect(annotation?.kind).toBe('ink');
    expect(annotation?.ink?.[0]).toHaveLength(3);
  });

  it('reads a note', async () => {
    const [annotation] = await read(
      await makeAnnotatedPdf([
        { subtype: 'Text', rect: [10, 700, 34, 724], contents: 'recordar' },
      ]),
    );
    expect(annotation?.kind).toBe('note');
    expect(annotation?.rect).toEqual({ x: 10, y: 702, width: 22, height: 22 });
  });

  it('reads a rectangle and an ellipse', async () => {
    const annotations = await read(
      await makeAnnotatedPdf([
        { subtype: 'Square', rect: [10, 10, 110, 60] },
        { subtype: 'Circle', rect: [10, 100, 110, 160] },
      ]),
    );
    expect(annotations.map((a) => a.kind)).toEqual(['rect', 'ellipse']);
  });

  it('leaves alone the kinds Reader does not understand', async () => {
    const annotations = await read(
      await makeAnnotatedPdf([
        { subtype: 'Link', rect: [10, 10, 110, 60] },
        { subtype: 'Polygon', rect: [10, 100, 110, 160] },
        { subtype: 'Square', rect: [10, 200, 110, 260] },
      ]),
    );
    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.kind).toBe('rect');
  });

  it('reads a text box written with another program', async () => {
    const annotations = await read(
      await makeAnnotatedPdf([{ subtype: 'FreeText', rect: [10, 100, 110, 160] }]),
    );
    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.kind).toBe('freetext');
  });

  it('gives nothing for a file with no annotations', async () => {
    expect(await read(await makeAnnotatedPdf([]))).toEqual([]);
  });
});
