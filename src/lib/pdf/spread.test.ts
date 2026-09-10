import { describe, expect, it } from 'vitest';
import {
  nextMode,
  pageOfRow,
  pageStep,
  rowHeights,
  rowOfPage,
  rowWidths,
  rowsFor,
} from './spread';

describe('nextMode', () => {
  it('walks the three modes in a circle', () => {
    expect(nextMode('continuous')).toBe('single');
    expect(nextMode('single')).toBe('double');
    expect(nextMode('double')).toBe('continuous');
  });
});

describe('rowsFor', () => {
  it('gives one page per row when reading continuously', () => {
    expect(rowsFor('continuous', 3, 1)).toEqual([[0], [1], [2]]);
  });

  it('gives only the page being read in single mode', () => {
    expect(rowsFor('single', 5, 3)).toEqual([[2]]);
  });

  it('keeps the single page inside the document', () => {
    expect(rowsFor('single', 3, 99)).toEqual([[2]]);
    expect(rowsFor('single', 3, 0)).toEqual([[0]]);
  });

  it('pairs the pages in double mode', () => {
    expect(rowsFor('double', 4, 1)).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('leaves the last page alone when there is an odd number', () => {
    expect(rowsFor('double', 5, 1)).toEqual([[0, 1], [2, 3], [4]]);
  });

  it('gives nothing for an empty document', () => {
    expect(rowsFor('continuous', 0, 1)).toEqual([]);
  });
});

describe('rowHeights', () => {
  it('takes the tallest page of the row', () => {
    expect(rowHeights([[0, 1]], [100, 140])).toEqual([140]);
  });
});

describe('rowWidths', () => {
  it('adds the pages of the row and the gap between them', () => {
    expect(rowWidths([[0, 1]], [100, 120], 16)).toEqual([236]);
  });

  it('leaves a lonely page as it is', () => {
    expect(rowWidths([[0]], [100], 16)).toEqual([100]);
  });
});

describe('rowOfPage', () => {
  it('finds the row a page sits in', () => {
    expect(rowOfPage(rowsFor('double', 4, 1), 3)).toBe(1);
  });

  it('falls back to the first row', () => {
    expect(rowOfPage([[0]], 9)).toBe(0);
  });
});

describe('pageOfRow', () => {
  it('reads the first page of the row', () => {
    expect(pageOfRow(rowsFor('double', 4, 1), 1)).toBe(3);
  });
});

describe('pageStep', () => {
  it('advances one page at a time', () => {
    expect(pageStep('single', 2, 9, true)).toBe(3);
  });

  it('advances two at a time in double mode', () => {
    expect(pageStep('double', 1, 9, true)).toBe(3);
  });

  it('goes back', () => {
    expect(pageStep('single', 2, 9, false)).toBe(1);
  });

  it('stops at the ends', () => {
    expect(pageStep('single', 1, 9, false)).toBe(1);
    expect(pageStep('single', 9, 9, true)).toBe(9);
  });
});
