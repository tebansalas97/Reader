import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FONT_SIZE,
  escapeLiteral,
  fontSizeOf,
  freeTextStream,
  lineHeight,
  linesOf,
  measureHelvetica,
  textOrigin,
  winAnsi,
  wrapText,
} from './freetext';
import type { Annotation } from './model';

function box(contents: string, extra: Partial<Annotation> = {}): Annotation {
  return {
    id: 'f1',
    page: 1,
    kind: 'freetext',
    color: '#1a1a1a',
    opacity: 1,
    contents,
    author: 'Esteban',
    createdMs: 1,
    origin: 'reader',
    rect: { x: 50, y: 400, width: 200, height: 100 },
    ...extra,
  };
}

describe('measureHelvetica', () => {
  it('measures a word the way the font does', () => {
    expect(Math.round(measureHelvetica('Hola', 12) * 100) / 100).toBe(24.67);
  });

  it('grows with the size', () => {
    expect(measureHelvetica('Hola', 24)).toBeCloseTo(measureHelvetica('Hola', 12) * 2, 5);
  });

  it('measures nothing for an empty text', () => {
    expect(measureHelvetica('', 12)).toBe(0);
  });
});

describe('fontSizeOf', () => {
  it('falls back to the usual size', () => {
    expect(fontSizeOf(box('hola'))).toBe(DEFAULT_FONT_SIZE);
  });

  it('takes the size that was asked for', () => {
    expect(fontSizeOf(box('hola', { fontSize: 20 }))).toBe(20);
  });

  it('refuses a size that makes no sense', () => {
    expect(fontSizeOf(box('hola', { fontSize: 0 }))).toBe(DEFAULT_FONT_SIZE);
    expect(fontSizeOf(box('hola', { fontSize: 500 }))).toBe(DEFAULT_FONT_SIZE);
  });
});

describe('wrapText', () => {
  it('keeps a short line whole', () => {
    expect(wrapText('Hola mundo', 200, 12, measureHelvetica)).toEqual(['Hola mundo']);
  });

  it('breaks where the width runs out', () => {
    const lines = wrapText('uno dos tres cuatro cinco seis', 60, 12, measureHelvetica);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(measureHelvetica(line, 12)).toBeLessThanOrEqual(60);
  });

  it('respects the line breaks that were typed', () => {
    expect(wrapText('uno\ndos', 200, 12, measureHelvetica)).toEqual(['uno', 'dos']);
  });

  it('keeps an empty line', () => {
    expect(wrapText('uno\n\ndos', 200, 12, measureHelvetica)).toEqual(['uno', '', 'dos']);
  });

  it('cuts a word that does not fit by itself', () => {
    const lines = wrapText('supercalifragilisticoespialidoso', 40, 12, measureHelvetica);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('supercalifragilisticoespialidoso');
  });
});

describe('textOrigin', () => {
  it('starts under the top edge', () => {
    const origin = textOrigin({ x: 50, y: 400, width: 200, height: 100 }, 12);
    expect(origin.x).toBe(52);
    expect(origin.y).toBe(486);
  });
});

describe('escapeLiteral', () => {
  it('protects the brackets and the backslash', () => {
    expect(escapeLiteral('(a\\b)')).toBe('\\(a\\\\b\\)');
  });
});

describe('winAnsi', () => {
  it('keeps the accents of Spanish', () => {
    expect(winAnsi('camión ñandú')).toBe('camión ñandú');
  });

  it('replaces what the font cannot draw', () => {
    expect(winAnsi('中文')).toBe('??');
  });
});

describe('linesOf', () => {
  it('wraps inside the box', () => {
    const many = linesOf(box('uno dos tres cuatro cinco seis siete ocho nueve diez'), measureHelvetica);
    expect(many.length).toBeGreaterThan(1);
  });

  it('gives nothing without a box', () => {
    expect(linesOf(box('hola', { rect: undefined }), measureHelvetica)).toEqual([]);
  });
});

describe('freeTextStream', () => {
  it('names the font and the size', () => {
    expect(freeTextStream(box('Hola'), measureHelvetica)).toContain('/ReaderF 12 Tf');
  });

  it('writes the text', () => {
    expect(freeTextStream(box('Hola'), measureHelvetica)).toContain('(Hola) Tj');
  });

  it('writes the colour of the letters', () => {
    expect(freeTextStream(box('Hola'), measureHelvetica)).toContain('0.10196 0.10196 0.10196 rg');
  });

  it('moves down for the second line', () => {
    const stream = freeTextStream(box('uno\ndos'), measureHelvetica);
    expect(stream).toContain('T*');
    expect(stream).toContain(`${lineHeight(12)} TL`);
  });

  it('gives nothing without a box', () => {
    expect(freeTextStream(box('hola', { rect: undefined }), measureHelvetica)).toBe('');
  });
});
