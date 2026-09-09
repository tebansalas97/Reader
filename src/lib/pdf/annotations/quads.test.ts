import { describe, expect, it } from 'vitest';
import type { PageSize } from '../document';
import { quadBounds } from './geometry';
import { localRects, mergeLines, quadsFromRects, scaleOf, type RectLike } from './quads';

const A4: PageSize = { width: 600, height: 800, rotation: 0 };
const PAGE: RectLike = { left: 100, top: 50, width: 600, height: 800 };

function rect(left: number, top: number, width: number, height: number): RectLike {
  return { left, top, width, height };
}

describe('localRects', () => {
  it('moves the rectangle to the corner of the page', () => {
    expect(localRects([rect(150, 100, 80, 12)], PAGE)).toEqual([
      { x: 50, y: 50, width: 80, height: 12 },
    ]);
  });

  it('drops a rectangle with no height', () => {
    expect(localRects([rect(150, 100, 80, 0)], PAGE)).toEqual([]);
  });

  it('drops a rectangle with no width', () => {
    expect(localRects([rect(150, 100, 0, 12)], PAGE)).toEqual([]);
  });

  it('drops a rectangle whose size is not a number', () => {
    expect(localRects([rect(150, 100, Number.NaN, 12)], PAGE)).toEqual([]);
  });

  it('cuts a rectangle that goes past the right edge', () => {
    const [only] = localRects([rect(650, 100, 200, 12)], PAGE);
    expect(only?.width).toBe(50);
  });

  it('cuts a rectangle that starts above the page', () => {
    const [only] = localRects([rect(150, 20, 80, 60)], PAGE);
    expect(only).toEqual({ x: 50, y: 0, width: 80, height: 30 });
  });

  it('drops a rectangle that falls outside the page', () => {
    expect(localRects([rect(900, 100, 80, 12)], PAGE)).toEqual([]);
  });
});

describe('mergeLines', () => {
  it('joins two halves of the same word', () => {
    const merged = mergeLines([
      { x: 10, y: 700, width: 30, height: 12 },
      { x: 40, y: 700, width: 20, height: 12 },
    ]);
    expect(merged).toEqual([{ x: 10, y: 700, width: 50, height: 12 }]);
  });

  it('keeps two lines apart', () => {
    const merged = mergeLines([
      { x: 10, y: 700, width: 30, height: 12 },
      { x: 10, y: 680, width: 30, height: 12 },
    ]);
    expect(merged).toHaveLength(2);
  });

  it('reads the lines from the top of the page down', () => {
    const merged = mergeLines([
      { x: 10, y: 680, width: 30, height: 12 },
      { x: 10, y: 700, width: 30, height: 12 },
    ]);
    expect(merged[0]?.y).toBe(700);
  });

  it('keeps two columns of the same line apart', () => {
    const merged = mergeLines([
      { x: 10, y: 700, width: 30, height: 12 },
      { x: 300, y: 700, width: 30, height: 12 },
    ]);
    expect(merged).toHaveLength(2);
  });

  it('takes the taller box when two pieces of a line differ in size', () => {
    const merged = mergeLines([
      { x: 10, y: 700, width: 30, height: 12 },
      { x: 40, y: 698, width: 20, height: 16 },
    ]);
    expect(merged[0]).toEqual({ x: 10, y: 698, width: 50, height: 16 });
  });

  it('joins pieces that overlap each other', () => {
    const merged = mergeLines([
      { x: 10, y: 700, width: 40, height: 12 },
      { x: 20, y: 700, width: 40, height: 12 },
    ]);
    expect(merged).toEqual([{ x: 10, y: 700, width: 50, height: 12 }]);
  });

  it('returns nothing for nothing', () => {
    expect(mergeLines([])).toEqual([]);
  });
});

describe('scaleOf', () => {
  it('reads the zoom from the size on screen', () => {
    expect(scaleOf({ left: 0, top: 0, width: 1200, height: 1600 }, A4, 0)).toBe(2);
  });

  it('reads it from the short side when the page is turned', () => {
    expect(scaleOf({ left: 0, top: 0, width: 800, height: 600 }, A4, 90)).toBe(1);
  });

  it('falls back to one for a page with no size on screen', () => {
    expect(scaleOf({ left: 0, top: 0, width: 0, height: 0 }, A4, 0)).toBe(1);
  });
});

describe('quadsFromRects', () => {
  it('turns a line of text into one quad in page coordinates', () => {
    const quads = quadsFromRects([rect(150, 100, 80, 12)], PAGE, A4, 0);
    expect(quads).toHaveLength(1);
    expect(quadBounds(quads[0]!)).toEqual({ x: 50, y: 738, width: 80, height: 12 });
  });

  it('writes the corners with the top edge first', () => {
    const [quad] = quadsFromRects([rect(150, 100, 80, 12)], PAGE, A4, 0);
    expect(quad!.y1).toBeGreaterThan(quad!.y3);
  });

  it('turns two lines into two quads', () => {
    const quads = quadsFromRects(
      [rect(150, 100, 80, 12), rect(150, 120, 200, 12)],
      PAGE,
      A4,
      0,
    );
    expect(quads).toHaveLength(2);
  });

  it('joins the pieces of a selection that starts in the middle of a word', () => {
    const quads = quadsFromRects(
      [rect(150, 100, 20, 12), rect(170, 100, 60, 12)],
      PAGE,
      A4,
      0,
    );
    expect(quads).toHaveLength(1);
    expect(quadBounds(quads[0]!).width).toBe(80);
  });

  it('drops the empty rectangles the browser hands back', () => {
    const quads = quadsFromRects(
      [rect(150, 100, 80, 12), rect(150, 100, 0, 0)],
      PAGE,
      A4,
      0,
    );
    expect(quads).toHaveLength(1);
  });

  it('lands on the same place when the page is turned', () => {
    const upright = quadsFromRects([rect(150, 100, 80, 12)], PAGE, A4, 0);
    const turned = quadsFromRects(
      [rect(100 + 738, 50 + 50, 12, 80)],
      { left: 100, top: 50, width: 800, height: 600 },
      A4,
      90,
    );
    const a = quadBounds(upright[0]!);
    const b = quadBounds(turned[0]!);
    expect(b.x).toBeCloseTo(a.x, 5);
    expect(b.y).toBeCloseTo(a.y, 5);
    expect(b.width).toBeCloseTo(a.width, 5);
    expect(b.height).toBeCloseTo(a.height, 5);
  });

  it('takes the zoom from the page on screen', () => {
    const quads = quadsFromRects(
      [rect(100, 50, 160, 24)],
      { left: 100, top: 50, width: 1200, height: 1600 },
      A4,
      0,
    );
    expect(quadBounds(quads[0]!)).toEqual({ x: 0, y: 788, width: 80, height: 12 });
  });

  it('returns nothing when there is no selection', () => {
    expect(quadsFromRects([], PAGE, A4, 0)).toEqual([]);
  });
});
