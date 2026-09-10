import { describe, expect, it } from 'vitest';
import { parseRange, rangeText } from './print-range';

describe('parseRange', () => {
  it('takes the whole document when nothing is written', () => {
    expect(parseRange('', 3)).toEqual([1, 2, 3]);
  });

  it('reads single pages', () => {
    expect(parseRange('1,3', 5)).toEqual([1, 3]);
  });

  it('reads a span', () => {
    expect(parseRange('2-4', 9)).toEqual([2, 3, 4]);
  });

  it('mixes spans and single pages without repeating', () => {
    expect(parseRange('1-3,2,5', 9)).toEqual([1, 2, 3, 5]);
  });

  it('understands an open span at the end', () => {
    expect(parseRange('3-', 5)).toEqual([3, 4, 5]);
  });

  it('understands an open span at the start', () => {
    expect(parseRange('-2', 5)).toEqual([1, 2]);
  });

  it('turns a backwards span around', () => {
    expect(parseRange('4-2', 9)).toEqual([2, 3, 4]);
  });

  it('leaves out what is beyond the document', () => {
    expect(parseRange('4,9', 5)).toEqual([4]);
  });

  it('clips a span to the document', () => {
    expect(parseRange('4-99', 5)).toEqual([4, 5]);
  });

  it('ignores what it cannot read', () => {
    expect(parseRange('hola, 2', 5)).toEqual([2]);
  });

  it('gives back nothing when nothing lands inside', () => {
    expect(parseRange('99', 5)).toEqual([]);
  });
});

describe('rangeText', () => {
  it('joins what is next to each other', () => {
    expect(rangeText([1, 2, 3, 7])).toBe('1-3,7');
  });

  it('sorts and removes what is repeated', () => {
    expect(rangeText([3, 1, 3, 2])).toBe('1-3');
  });

  it('writes nothing for an empty choice', () => {
    expect(rangeText([])).toBe('');
  });

  it('is read back by parseRange', () => {
    expect(parseRange(rangeText([2, 3, 8]), 10)).toEqual([2, 3, 8]);
  });
});
