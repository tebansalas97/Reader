import { describe, expect, it } from 'vitest';
import {
  bytesOfWide,
  codeMapOf,
  codesOfWide,
  parseToUnicode,
  parseWideWidths,
  reverseCodes,
} from './cmap';

const CMAP = [
  '/CIDInit /ProcSet findresource begin',
  '12 dict begin',
  'begincmap',
  '1 beginbfchar',
  '<0024> <0041>',
  'endbfchar',
  '2 beginbfrange',
  '<0030> <0032> <0061>',
  '<0040> <0041> [<00E1> <00E9>]',
  'endbfrange',
  'endcmap',
].join('\n');

describe('parseToUnicode', () => {
  it('reads a single character', () => {
    expect(parseToUnicode(CMAP).get(0x24)).toBe('A');
  });

  it('reads a range that counts up', () => {
    const map = parseToUnicode(CMAP);
    expect(map.get(0x30)).toBe('a');
    expect(map.get(0x31)).toBe('b');
    expect(map.get(0x32)).toBe('c');
  });

  it('reads a range given as a list', () => {
    const map = parseToUnicode(CMAP);
    expect(map.get(0x40)).toBe('á');
    expect(map.get(0x41)).toBe('é');
  });

  it('gives nothing for a file that is not a cmap', () => {
    expect(parseToUnicode('hola').size).toBe(0);
  });
});

describe('reverseCodes', () => {
  it('turns the map around', () => {
    expect(reverseCodes(parseToUnicode(CMAP)).get('A')).toBe(0x24);
  });

  it('keeps the first code when two say the same', () => {
    const map = new Map([
      [1, 'a'],
      [2, 'a'],
    ]);
    expect(reverseCodes(map).get('a')).toBe(1);
  });
});

describe('codeMapOf', () => {
  it('reads both directions at once', () => {
    const map = codeMapOf(CMAP);
    expect(map.toText.get(0x24)).toBe('A');
    expect(map.toCode.get('A')).toBe(0x24);
  });
});

describe('parseWideWidths', () => {
  it('reads a list of widths', () => {
    const widths = parseWideWidths([10, [500, 600, 700]]);
    expect(widths.get(10)).toBe(500);
    expect(widths.get(12)).toBe(700);
  });

  it('reads a range with one width', () => {
    const widths = parseWideWidths([20, 22, 450]);
    expect(widths.get(20)).toBe(450);
    expect(widths.get(22)).toBe(450);
  });

  it('reads both shapes in the same array', () => {
    const widths = parseWideWidths([1, [100], 5, 6, 200]);
    expect(widths.get(1)).toBe(100);
    expect(widths.get(6)).toBe(200);
  });

  it('stops at something it cannot read', () => {
    expect(parseWideWidths([1]).size).toBe(0);
  });
});

describe('codesOfWide', () => {
  it('reads two bytes per code', () => {
    expect(codesOfWide(String.fromCharCode(0, 0x41, 1, 0x42))).toEqual([0x41, 0x142]);
  });

  it('ignores a lonely byte at the end', () => {
    expect(codesOfWide(String.fromCharCode(0, 0x41, 0))).toEqual([0x41]);
  });
});

describe('bytesOfWide', () => {
  it('writes two bytes per code', () => {
    expect(bytesOfWide([0x41])).toBe(String.fromCharCode(0, 0x41));
  });

  it('is read back by codesOfWide', () => {
    expect(codesOfWide(bytesOfWide([1, 2, 300]))).toEqual([1, 2, 300]);
  });
});
