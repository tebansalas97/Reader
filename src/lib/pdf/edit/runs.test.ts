import { describe, expect, it } from 'vitest';
import { advanceOf, findRuns, multiply, originOf, translation, type FontMetrics } from './runs';
import { tokenize } from './tokens';

const HALF: FontMetrics = { widthOf: () => 500, measurable: true };
const UNKNOWN = null;

function fonts(name: string): FontMetrics | null {
  return name === 'F1' ? HALF : UNKNOWN;
}

function runsOf(source: string) {
  return findRuns(tokenize(source), fonts);
}

describe('multiply', () => {
  it('leaves a matrix alone when it multiplies by the identity', () => {
    expect(multiply([1, 0, 0, 1, 0, 0], [2, 0, 0, 3, 4, 5])).toEqual([2, 0, 0, 3, 4, 5]);
  });

  it('adds up two moves', () => {
    expect(multiply(translation(10, 20), translation(1, 2))).toEqual([1, 0, 0, 1, 11, 22]);
  });

  it('scales a move by the outer matrix', () => {
    expect(multiply([2, 0, 0, 2, 0, 0], translation(3, 4))).toEqual([2, 0, 0, 2, 6, 8]);
  });
});

describe('findRuns', () => {
  it('finds one run and where it starts', () => {
    const runs = runsOf('BT /F1 12 Tf 60 700 Td (hola) Tj ET');
    expect(runs).toHaveLength(1);
    expect(runs[0]?.bytes).toBe('hola');
    expect(runs[0]?.font).toBe('F1');
    expect(runs[0]?.size).toBe(12);
    expect(originOf(runs[0]!)).toEqual({ x: 60, y: 700 });
  });

  it('follows the text matrix', () => {
    const runs = runsOf('BT /F1 10 Tf 1 0 0 1 100 200 Tm (a) Tj ET');
    expect(originOf(runs[0]!)).toEqual({ x: 100, y: 200 });
  });

  it('follows the page transform', () => {
    const runs = runsOf('q 1 0 0 1 10 20 cm BT /F1 10 Tf 5 5 Td (a) Tj ET Q');
    expect(originOf(runs[0]!)).toEqual({ x: 15, y: 25 });
  });

  it('forgets the transform after Q', () => {
    const runs = runsOf('q 1 0 0 1 10 20 cm Q BT /F1 10 Tf 5 5 Td (a) Tj ET');
    expect(originOf(runs[0]!)).toEqual({ x: 5, y: 5 });
  });

  it('moves along the line after showing text', () => {
    const runs = runsOf('BT /F1 10 Tf 60 700 Td (ab) Tj (cd) Tj ET');
    expect(runs).toHaveLength(2);
    expect(originOf(runs[1]!).x).toBe(70);
  });

  it('counts the letter spacing when it moves along', () => {
    const runs = runsOf('BT /F1 10 Tf 2 Tc 60 700 Td (ab) Tj (cd) Tj ET');
    expect(originOf(runs[1]!).x).toBe(74);
  });

  it('counts the word spacing on the spaces', () => {
    const runs = runsOf('BT /F1 10 Tf 5 Tw 60 700 Td (a b) Tj (c) Tj ET');
    expect(originOf(runs[1]!).x).toBe(80);
  });

  it('goes down a line with T star', () => {
    const runs = runsOf('BT /F1 10 Tf 14 TL 60 700 Td (uno) Tj T* (dos) Tj ET');
    expect(originOf(runs[1]!)).toEqual({ x: 60, y: 686 });
  });

  it('takes the leading from TD', () => {
    const runs = runsOf('BT /F1 10 Tf 60 700 Td 0 -20 TD (uno) Tj T* (dos) Tj ET');
    expect(originOf(runs[1]!).y).toBe(660);
  });

  it('reads a TJ array as one run', () => {
    const runs = runsOf('BT /F1 10 Tf 60 700 Td [(ho) -250 (la)] TJ ET');
    expect(runs).toHaveLength(1);
    expect(runs[0]?.bytes).toBe('hola');
    expect(runs[0]?.operator).toBe('TJ');
    expect(runs[0]?.stringTokens).toHaveLength(2);
  });

  it('counts the kerning of a TJ array in the advance', () => {
    const runs = runsOf('BT /F1 10 Tf 60 700 Td [(ho) -250 (la)] TJ (x) Tj ET');
    expect(originOf(runs[1]!).x).toBeCloseTo(60 + 20 + 2.5, 5);
  });

  it('reads a quote as a new line and a show', () => {
    const runs = runsOf("BT /F1 10 Tf 14 TL 60 700 Td (uno) Tj (dos) ' ET");
    expect(originOf(runs[1]!)).toEqual({ x: 60, y: 686 });
  });

  it('reads a double quote with its spacing', () => {
    const runs = runsOf('BT /F1 10 Tf 14 TL 60 700 Td 3 1 (uno) " ET');
    expect(runs[0]?.wordSpacing).toBe(3);
    expect(runs[0]?.charSpacing).toBe(1);
  });

  it('says when it could not measure the font', () => {
    const runs = runsOf('BT /F9 10 Tf 60 700 Td (hola) Tj ET');
    expect(runs[0]?.measured).toBe(false);
  });

  it('reads a hex string as text', () => {
    const runs = runsOf('BT /F1 10 Tf 60 700 Td <686f6c61> Tj ET');
    expect(runs[0]?.bytes).toBe('hola');
  });

  it('ignores a stream with no text', () => {
    expect(runsOf('q 1 0 0 1 0 0 cm 10 10 100 100 re f Q')).toEqual([]);
  });

  it('does not trip over an inline image', () => {
    const runs = runsOf('BI /W 1 /H 1 ID \x00\x01 EI BT /F1 10 Tf 5 5 Td (a) Tj ET');
    expect(runs).toHaveLength(1);
  });

  it('remembers which tokens make up the run', () => {
    const source = 'BT /F1 10 Tf 60 700 Td [(ho) -250 (la)] TJ ET';
    const tokens = tokenize(source);
    const runs = findRuns(tokens, fonts);
    const run = runs[0]!;
    expect(tokens[run.firstToken]?.text).toBe('[');
    expect(tokens[run.lastToken]?.text).toBe('TJ');
  });
});

describe('advanceOf', () => {
  it('measures with the width of each letter', () => {
    expect(advanceOf('abc', HALF, 10, 0, 0, 1)).toBe(15);
  });

  it('adds the letter spacing', () => {
    expect(advanceOf('abc', HALF, 10, 1, 0, 1)).toBe(18);
  });

  it('adds the word spacing only on spaces', () => {
    expect(advanceOf('a b', HALF, 10, 0, 4, 1)).toBe(19);
  });

  it('scales by the horizontal setting', () => {
    expect(advanceOf('ab', HALF, 10, 0, 0, 0.5)).toBe(5);
  });

  it('measures nothing without metrics', () => {
    expect(advanceOf('abc', null, 10, 0, 0, 1)).toBe(0);
  });
});
