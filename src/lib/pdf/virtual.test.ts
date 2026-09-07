import { describe, expect, it } from 'vitest';
import {
  offsetOfPage,
  pageAtOffset,
  pageSlots,
  shouldKeep,
  totalHeight,
  visibleRange,
} from './virtual';

const EQUAL = [100, 100, 100, 100, 100];
const MIXED = [50, 200, 80, 300];

describe('pageSlots', () => {
  it('stacks the pages with the gap between them', () => {
    expect(pageSlots([100, 100], 10).map((s) => s.top)).toEqual([0, 110]);
  });

  it('returns nothing for a document with no pages', () => {
    expect(pageSlots([], 10)).toEqual([]);
  });

  it('treats a negative height as zero', () => {
    expect(pageSlots([-5, 100], 0)[1]?.top).toBe(0);
  });
});

describe('totalHeight', () => {
  it('adds the pages and the gaps between them', () => {
    expect(totalHeight([100, 100, 100], 10)).toBe(320);
  });

  it('adds no gap for a single page', () => {
    expect(totalHeight([100], 10)).toBe(100);
  });

  it('is zero for an empty document', () => {
    expect(totalHeight([], 10)).toBe(0);
  });
});

describe('pageAtOffset', () => {
  const slots = pageSlots(EQUAL, 0);

  it('returns the first page at the top', () => {
    expect(pageAtOffset(slots, 0)).toBe(0);
  });

  it('returns the page under the offset', () => {
    expect(pageAtOffset(slots, 250)).toBe(2);
  });

  it('returns the first page above the document', () => {
    expect(pageAtOffset(slots, -100)).toBe(0);
  });

  it('returns the last page below the document', () => {
    expect(pageAtOffset(slots, 99999)).toBe(4);
  });

  it('returns zero for an empty document', () => {
    expect(pageAtOffset([], 100)).toBe(0);
  });
});

describe('visibleRange', () => {
  it('shows the first pages at the top', () => {
    const range = visibleRange(EQUAL, 0, 250, 0, 0);
    expect(range.first).toBe(0);
    expect(range.last).toBe(2);
  });

  it('moves with the scroll', () => {
    const range = visibleRange(EQUAL, 200, 200, 0, 0);
    expect(range.first).toBe(2);
    expect(range.last).toBe(3);
  });

  it('does not count a page that ends exactly at the top edge', () => {
    const range = visibleRange(EQUAL, 100, 100, 0, 0);
    expect(range.first).toBe(1);
    expect(range.last).toBe(1);
  });

  it('handles pages of different heights', () => {
    const range = visibleRange(MIXED, 0, 240, 0, 0);
    expect(range.first).toBe(0);
    expect(range.last).toBe(1);
  });

  it('counts a tall page that only just starts inside the window', () => {
    const range = visibleRange(MIXED, 0, 260, 0, 0);
    expect(range.last).toBe(2);
  });

  it('adds the overscan on both sides', () => {
    const range = visibleRange(EQUAL, 200, 100, 2, 0);
    expect(range.renderFirst).toBe(0);
    expect(range.renderLast).toBe(4);
  });

  it('never asks for a page before the first', () => {
    expect(visibleRange(EQUAL, 0, 100, 3, 0).renderFirst).toBe(0);
  });

  it('never asks for a page after the last', () => {
    expect(visibleRange(EQUAL, 400, 100, 3, 0).renderLast).toBe(4);
  });

  it('falls back to the nearest page when nothing is visible', () => {
    const range = visibleRange(EQUAL, 99999, 100, 0, 0);
    expect(range.first).toBe(4);
    expect(range.last).toBe(4);
  });

  it('returns an empty range for a document with no pages', () => {
    const range = visibleRange([], 0, 500);
    expect(range.last).toBeLessThan(range.first);
  });

  it('tolerates a viewport of zero', () => {
    expect(() => visibleRange(EQUAL, 0, 0)).not.toThrow();
  });
});

describe('offsetOfPage', () => {
  it('returns zero for the first page', () => {
    expect(offsetOfPage(EQUAL, 0, 0)).toBe(0);
  });

  it('returns the top of the page asked for', () => {
    expect(offsetOfPage(EQUAL, 2, 10)).toBe(220);
  });

  it('clamps a page past the end', () => {
    expect(offsetOfPage(EQUAL, 99, 0)).toBe(400);
  });

  it('is zero for an empty document', () => {
    expect(offsetOfPage([], 3)).toBe(0);
  });
});

describe('shouldKeep', () => {
  const range = visibleRange(EQUAL, 200, 100, 1, 0);

  it('keeps a page inside the render window', () => {
    expect(shouldKeep(range, 2)).toBe(true);
  });

  it('drops a page outside it', () => {
    expect(shouldKeep(range, 0)).toBe(false);
  });
});
