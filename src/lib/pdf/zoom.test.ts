import { describe, expect, it } from 'vitest';
import type { PageSize } from './document';
import { MAX_SCALE, MIN_SCALE } from './render';
import {
  anchoredOffset,
  centredOffset,
  contentWidth,
  pageHeights,
  pageWidths,
  tallestPage,
  wheelZoom,
  widestPage,
} from './zoom';

const A4: PageSize = { width: 600, height: 800, rotation: 0 };
const WIDE: PageSize = { width: 1000, height: 500, rotation: 0 };
const SMALL: PageSize = { width: 300, height: 400, rotation: 0 };

describe('anchoredOffset', () => {
  it('keeps the point under the pointer when zooming in', () => {
    expect(anchoredOffset(100, 50, 1, 2)).toBe(250);
  });

  it('keeps it when zooming out', () => {
    expect(anchoredOffset(250, 50, 2, 1)).toBe(100);
  });

  it('leaves the offset alone when the scale does not change', () => {
    expect(anchoredOffset(120, 40, 1.5, 1.5)).toBe(120);
  });

  it('never scrolls above the top', () => {
    expect(anchoredOffset(0, 10, 4, 0.5)).toBe(0);
  });

  it('anchors at the very top of the document', () => {
    expect(anchoredOffset(0, 0, 1, 3)).toBe(0);
  });

  it('survives a scale of zero', () => {
    expect(anchoredOffset(80, 10, 0, 2)).toBe(80);
  });

  it('survives a scale that is not a number', () => {
    expect(anchoredOffset(80, 10, 1, Number.NaN)).toBe(80);
  });
});

describe('centredOffset', () => {
  it('centres content wider than the window', () => {
    expect(centredOffset(1000, 600)).toBe(200);
  });

  it('stays at zero when the content fits', () => {
    expect(centredOffset(400, 600)).toBe(0);
  });

  it('stays at zero when they match exactly', () => {
    expect(centredOffset(600, 600)).toBe(0);
  });
});

describe('widestPage', () => {
  it('finds the widest of several', () => {
    expect(widestPage([A4, WIDE, SMALL], 0)).toBe(WIDE);
  });

  it('changes its answer when the pages are turned', () => {
    expect(widestPage([A4, WIDE], 90)).toBe(A4);
  });

  it('returns null for a document with no pages', () => {
    expect(widestPage([], 0)).toBeNull();
  });
});

describe('tallestPage', () => {
  it('finds the tallest of several', () => {
    expect(tallestPage([A4, WIDE, SMALL], 0)).toBe(A4);
  });

  it('changes its answer when the pages are turned', () => {
    expect(tallestPage([A4, WIDE], 90)).toBe(WIDE);
  });

  it('returns null for a document with no pages', () => {
    expect(tallestPage([], 0)).toBeNull();
  });
});

describe('pageHeights', () => {
  it('scales every page', () => {
    expect(pageHeights([A4, SMALL], 2, 0)).toEqual([1600, 800]);
  });

  it('swaps the sides when the pages are turned', () => {
    expect(pageHeights([A4], 1, 90)).toEqual([600]);
  });

  it('adds the rotation the page already had', () => {
    const turned: PageSize = { width: 600, height: 800, rotation: 90 };
    expect(pageHeights([turned], 1, 0)).toEqual([600]);
  });

  it('returns nothing for a document with no pages', () => {
    expect(pageHeights([], 1, 0)).toEqual([]);
  });
});

describe('contentWidth', () => {
  it('measures by the widest page', () => {
    expect(contentWidth([A4, WIDE], 1, 0)).toBe(1000);
  });

  it('scales with the zoom', () => {
    expect(contentWidth([A4], 2, 0)).toBe(1200);
  });

  it('is zero for a document with no pages', () => {
    expect(contentWidth([], 1, 0)).toBe(0);
  });
});

describe('wheelZoom', () => {
  it('zooms in when the wheel goes up', () => {
    expect(wheelZoom(1, -100)).toBeGreaterThan(1);
  });

  it('zooms out when the wheel goes down', () => {
    expect(wheelZoom(1, 100)).toBeLessThan(1);
  });

  it('comes back near the start after in and out', () => {
    expect(wheelZoom(wheelZoom(1, -100), 100)).toBeCloseTo(1, 2);
  });

  it('never goes past the maximum', () => {
    expect(wheelZoom(MAX_SCALE, -100)).toBe(MAX_SCALE);
  });

  it('never goes below the minimum', () => {
    expect(wheelZoom(MIN_SCALE, 100)).toBe(MIN_SCALE);
  });
});

describe('pageWidths', () => {
  it('measures every page across', () => {
    const sizes: PageSize[] = [
      { width: 600, height: 800, rotation: 0 },
      { width: 300, height: 400, rotation: 0 },
    ];
    expect(pageWidths(sizes, 2, 0)).toEqual([1200, 600]);
  });

  it('follows the rotation', () => {
    const sizes: PageSize[] = [{ width: 600, height: 800, rotation: 0 }];
    expect(pageWidths(sizes, 1, 90)).toEqual([800]);
  });
});
