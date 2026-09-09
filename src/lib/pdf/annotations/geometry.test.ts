import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { makeOffsetPdf, makePdf, makeRotatedPdf } from '../../../test/pdf-fixtures';
import { openPdfDocument, type PdfHandle, type PageSize } from '../document';
import { loadPdfjs } from '../load';
import type { Point } from './model';
import {
  applyMatrix,
  invertMatrix,
  multiplyMatrix,
  normalizeRotation,
  quadBounds,
  quadToScreenRect,
  rectToQuad,
  strokeToPdf,
  strokeToScreen,
  insideRect,
  toPdfPoint,
  toPdfRect,
  toScreenPoint,
  toScreenRect,
  totalRotation,
  viewportTransform,
} from './geometry';

const A4: PageSize = { width: 600, height: 800, rotation: 0 };
const TURNED: PageSize = { width: 600, height: 800, rotation: 90 };
const OFFSET: PageSize = { width: 600, height: 800, rotation: 0, offsetX: 20, offsetY: 40 };

const ROTATIONS = [0, 90, 180, 270];

describe('normalizeRotation', () => {
  it('leaves a quarter turn alone', () => {
    expect(normalizeRotation(90)).toBe(90);
  });

  it('brings a full turn back to zero', () => {
    expect(normalizeRotation(360)).toBe(0);
  });

  it('turns a negative rotation into a positive one', () => {
    expect(normalizeRotation(-90)).toBe(270);
  });

  it('snaps a rotation that is not a quarter turn', () => {
    expect(normalizeRotation(100)).toBe(90);
  });

  it('falls back to zero for a value that is not a number', () => {
    expect(normalizeRotation(Number.NaN)).toBe(0);
  });
});

describe('totalRotation', () => {
  it('adds the rotation of the page to the one asked for', () => {
    expect(totalRotation(TURNED, 90)).toBe(180);
  });

  it('wraps around a full turn', () => {
    expect(totalRotation(TURNED, 270)).toBe(0);
  });
});

describe('viewportTransform', () => {
  it('puts the bottom left corner of the page at the bottom left of the screen', () => {
    const point = toScreenPoint({ x: 0, y: 0 }, A4, 1, 0);
    expect(point).toEqual({ x: 0, y: 800 });
  });

  it('puts the top left corner at the origin of the screen', () => {
    expect(toScreenPoint({ x: 0, y: 800 }, A4, 1, 0)).toEqual({ x: 0, y: 0 });
  });

  it('multiplies by the zoom', () => {
    expect(toScreenPoint({ x: 100, y: 800 }, A4, 2, 0)).toEqual({ x: 200, y: 0 });
  });

  it('takes the offset of the page box off the coordinates', () => {
    expect(toScreenPoint({ x: 20, y: 840 }, OFFSET, 1, 0)).toEqual({ x: 0, y: 0 });
  });

  it('sends the top left corner to the top right at a quarter turn', () => {
    const point = toScreenPoint({ x: 0, y: 800 }, A4, 1, 90);
    expect(point.x).toBeCloseTo(800, 6);
    expect(point.y).toBeCloseTo(0, 6);
  });

  it('sends the bottom right corner to the top left at half a turn', () => {
    const point = toScreenPoint({ x: 600, y: 0 }, A4, 1, 180);
    expect(point.x).toBeCloseTo(0, 6);
    expect(point.y).toBeCloseTo(0, 6);
  });

  it('adds the rotation the page already had', () => {
    expect(toScreenPoint({ x: 10, y: 20 }, TURNED, 1, 0)).toEqual(
      toScreenPoint({ x: 10, y: 20 }, A4, 1, 90),
    );
  });
});

describe('toPdfPoint', () => {
  for (const rotation of ROTATIONS) {
    it(`comes back to the same point at ${rotation} degrees`, () => {
      const start: Point = { x: 123.5, y: 456.25 };
      const screen = toScreenPoint(start, A4, 1.75, rotation);
      const back = toPdfPoint(screen, A4, 1.75, rotation);
      expect(back.x).toBeCloseTo(start.x, 6);
      expect(back.y).toBeCloseTo(start.y, 6);
    });
  }

  it('comes back to the same point on a page with an offset box', () => {
    const start: Point = { x: 100, y: 200 };
    const back = toPdfPoint(toScreenPoint(start, OFFSET, 2, 270), OFFSET, 2, 270);
    expect(back.x).toBeCloseTo(start.x, 6);
    expect(back.y).toBeCloseTo(start.y, 6);
  });
});

describe('invertMatrix', () => {
  it('undoes the transform', () => {
    const matrix = viewportTransform(A4, 1.5, 90);
    const identity = multiplyMatrix(invertMatrix(matrix), matrix);
    expect(identity[0]).toBeCloseTo(1, 6);
    expect(identity[3]).toBeCloseTo(1, 6);
    expect(identity[4]).toBeCloseTo(0, 6);
    expect(identity[5]).toBeCloseTo(0, 6);
  });

  it('falls back to the identity for a matrix that cannot be inverted', () => {
    expect(invertMatrix([0, 0, 0, 0, 5, 5])).toEqual([1, 0, 0, 1, 0, 0]);
  });
});

describe('rects', () => {
  it('turns a page rectangle into a screen one', () => {
    const rect = toScreenRect({ x: 100, y: 100, width: 200, height: 50 }, A4, 1, 0);
    expect(rect).toEqual({ x: 100, y: 650, width: 200, height: 50 });
  });

  it('never returns a rectangle with negative sides', () => {
    const rect = toScreenRect({ x: 100, y: 100, width: 200, height: 50 }, A4, 1, 180);
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
  });

  for (const rotation of ROTATIONS) {
    it(`comes back to the same rectangle at ${rotation} degrees`, () => {
      const start = { x: 40, y: 60, width: 120, height: 30 };
      const back = toPdfRect(toScreenRect(start, A4, 1.25, rotation), A4, 1.25, rotation);
      expect(back.x).toBeCloseTo(start.x, 6);
      expect(back.y).toBeCloseTo(start.y, 6);
      expect(back.width).toBeCloseTo(start.width, 6);
      expect(back.height).toBeCloseTo(start.height, 6);
    });
  }

  it('swaps the sides of a rectangle at a quarter turn', () => {
    const rect = toScreenRect({ x: 0, y: 0, width: 100, height: 20 }, A4, 1, 90);
    expect(rect.width).toBeCloseTo(20, 6);
    expect(rect.height).toBeCloseTo(100, 6);
  });
});

describe('quads', () => {
  it('writes the corners in the order the PDF spec asks for', () => {
    expect(rectToQuad({ x: 10, y: 20, width: 100, height: 12 })).toEqual({
      x1: 10,
      y1: 32,
      x2: 110,
      y2: 32,
      x3: 10,
      y3: 20,
      x4: 110,
      y4: 20,
    });
  });

  it('comes back to the rectangle it was made from', () => {
    const rect = { x: 10, y: 20, width: 100, height: 12 };
    expect(quadBounds(rectToQuad(rect))).toEqual(rect);
  });

  it('turns a quad into the box to paint on screen', () => {
    const quad = rectToQuad({ x: 0, y: 780, width: 100, height: 20 });
    expect(quadToScreenRect(quad, A4, 1, 0)).toEqual({ x: 0, y: 0, width: 100, height: 20 });
  });

  it('turns the box when the page is turned', () => {
    const quad = rectToQuad({ x: 0, y: 780, width: 100, height: 20 });
    const rect = quadToScreenRect(quad, A4, 1, 90);
    expect(rect.width).toBeCloseTo(20, 6);
    expect(rect.height).toBeCloseTo(100, 6);
  });
});

describe('strokes', () => {
  it('comes back to the same stroke', () => {
    const stroke = [
      { x: 10, y: 10 },
      { x: 20, y: 40 },
    ];
    const back = strokeToPdf(strokeToScreen(stroke, A4, 1.5, 270), A4, 1.5, 270);
    expect(back[0]?.x).toBeCloseTo(10, 6);
    expect(back[1]?.y).toBeCloseTo(40, 6);
  });

  it('keeps an empty stroke empty', () => {
    expect(strokeToScreen([], A4, 1, 0)).toEqual([]);
  });
});

describe('insideRect', () => {
  const rect = { x: 10, y: 10, width: 100, height: 50 };

  it('finds a point inside', () => {
    expect(insideRect(rect, { x: 50, y: 30 })).toBe(true);
  });

  it('leaves a point outside out', () => {
    expect(insideRect(rect, { x: 5, y: 30 })).toBe(false);
  });

  it('lets a point in with some slack', () => {
    expect(insideRect(rect, { x: 5, y: 30 }, 6)).toBe(true);
  });
});

describe('against the viewport of pdf.js', () => {
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

  async function firstPage(bytes: Uint8Array) {
    const handle = await openPdfDocument(bytes);
    open.push(handle);
    return { handle, page: await handle.page(1) };
  }

  async function compare(bytes: Uint8Array, scale: number, rotation: number) {
    const { handle, page } = await firstPage(bytes);
    const size = handle.pageSizes[0]!;
    const viewport = page.getViewport({ scale, rotation: page.rotate + rotation });
    const mine = viewportTransform(size, scale, rotation);
    for (let i = 0; i < 6; i += 1) {
      expect(mine[i]).toBeCloseTo(viewport.transform[i]!, 6);
    }
    return { size, viewport };
  }

  for (const rotation of ROTATIONS) {
    it(`matches the transform of pdf.js at ${rotation} degrees`, async () => {
      await compare(await makePdf([{ text: 'a' }]), 1.5, rotation);
    });
  }

  it('matches the transform of a page that is already turned', async () => {
    await compare(await makeRotatedPdf(90), 1, 90);
  });

  it('matches the transform of a page whose box has an offset', async () => {
    await compare(await makeOffsetPdf(), 2, 0);
  });

  it('lands on the same point as pdf.js', async () => {
    const { size, viewport } = await compare(await makePdf([{ text: 'a' }]), 1.3, 270);
    const theirs = viewport.convertToViewportPoint(123, 456);
    const mine = toScreenPoint({ x: 123, y: 456 }, size, 1.3, 270);
    expect(mine.x).toBeCloseTo(theirs[0]!, 6);
    expect(mine.y).toBeCloseTo(theirs[1]!, 6);
  });

  it('measures the page the same way pdf.js does', async () => {
    const { handle, page } = await firstPage(await makeRotatedPdf(90));
    const viewport = page.getViewport({ scale: 1, rotation: page.rotate });
    const size = handle.pageSizes[0]!;
    const corner = applyMatrix(viewportTransform(size, 1, 0), { x: 0, y: 0 });
    expect(viewport.width).toBeCloseTo(800, 6);
    expect(corner.x).toBeCloseTo(0, 6);
    expect(corner.y).toBeCloseTo(0, 6);
  });
});
