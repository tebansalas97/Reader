import { describe, expect, it } from 'vitest';
import {
  appearanceBounds,
  appearanceStream,
  hexToRgb,
  INK_WIDTH,
  inkNumbers,
  needsMultiply,
  NOTE_SIZE,
  num,
  pdfDate,
  quadNumbers,
  rectNumbers,
} from './appearance';
import { rectToQuad } from './geometry';
import type { Annotation, AnnotationKind } from './model';

function annotation(kind: AnnotationKind, extra: Partial<Annotation> = {}): Annotation {
  return {
    id: 'a1',
    page: 1,
    kind,
    color: '#ffd400',
    opacity: 1,
    contents: '',
    author: 'Esteban',
    createdMs: 0,
    origin: 'reader',
    ...extra,
  };
}

const QUADS = [rectToQuad({ x: 10, y: 700, width: 100, height: 12 })];

describe('num', () => {
  it('writes a round number without decimals', () => {
    expect(num(10)).toBe('10');
  });

  it('cuts to two decimals', () => {
    expect(num(1.23456)).toBe('1.23');
  });

  it('never writes exponents', () => {
    expect(num(0.0000001)).toBe('0');
  });

  it('writes zero for a value that is not a number', () => {
    expect(num(Number.NaN)).toBe('0');
  });

  it('never writes a negative zero', () => {
    expect(num(-0.001)).toBe('0');
  });
});

describe('hexToRgb', () => {
  it('reads a colour', () => {
    expect(hexToRgb('#ff0000')).toEqual([1, 0, 0]);
  });

  it('reads it without the hash', () => {
    expect(hexToRgb('00ff00')).toEqual([0, 1, 0]);
  });

  it('falls back to black for something that is not a colour', () => {
    expect(hexToRgb('rojo')).toEqual([0, 0, 0]);
  });
});

describe('pdfDate', () => {
  it('writes the date the way a PDF wants it', () => {
    expect(pdfDate(Date.UTC(2024, 0, 2, 3, 4, 5))).toBe('D:20240102030405Z');
  });

  it('uses now for a date that is missing', () => {
    expect(pdfDate(0)).toMatch(/^D:\d{14}Z$/);
  });
});

describe('appearanceBounds', () => {
  it('wraps the quads of a highlight', () => {
    expect(appearanceBounds(annotation('highlight', { quads: QUADS }))).toEqual({
      x: 10,
      y: 700,
      width: 100,
      height: 12,
    });
  });

  it('leaves room for the width of the pen', () => {
    const ink = annotation('ink', {
      ink: [
        [
          { x: 10, y: 10 },
          { x: 30, y: 40 },
        ],
      ],
    });
    expect(appearanceBounds(ink)).toEqual({
      x: 10 - INK_WIDTH,
      y: 10 - INK_WIDTH,
      width: 20 + INK_WIDTH * 2,
      height: 30 + INK_WIDTH * 2,
    });
  });

  it('gives a note the size of its icon', () => {
    const note = annotation('note', { rect: { x: 10, y: 700, width: 4, height: 4 } });
    expect(appearanceBounds(note)).toEqual({
      x: 10,
      y: 700,
      width: NOTE_SIZE,
      height: NOTE_SIZE,
    });
  });

  it('gives nothing for an annotation with no geometry', () => {
    expect(appearanceBounds(annotation('highlight'))).toBeNull();
  });
});

describe('appearanceStream', () => {
  it('fills the quads of a highlight', () => {
    const stream = appearanceStream(annotation('highlight', { quads: QUADS }));
    expect(stream).toContain('10 700 100 12 re');
    expect(stream).toContain('f');
  });

  it('multiplies the highlight so the text shows through', () => {
    expect(appearanceStream(annotation('highlight', { quads: QUADS }))).toContain('/GSMul gs');
    expect(needsMultiply(annotation('highlight'))).toBe(true);
  });

  it('writes the colour of the annotation', () => {
    const stream = appearanceStream(annotation('highlight', { quads: QUADS, color: '#ff0000' }));
    expect(stream).toContain('1 0 0 rg');
  });

  it('puts the underline at the foot of the line', () => {
    const stream = appearanceStream(annotation('underline', { quads: QUADS }));
    expect(stream).toMatch(/10 700\.48 100 [\d.]+ re/);
  });

  it('puts the strikeout across the middle', () => {
    const stream = appearanceStream(annotation('strikeout', { quads: QUADS }));
    expect(stream).toMatch(/10 705\.04 100 [\d.]+ re/);
  });

  it('never draws a line thinner than the printer can', () => {
    const tiny = [rectToQuad({ x: 0, y: 0, width: 10, height: 1 })];
    expect(appearanceStream(annotation('underline', { quads: tiny }))).toContain('0.6 re');
  });

  it('draws every stroke of a drawing', () => {
    const stream = appearanceStream(
      annotation('ink', {
        ink: [
          [
            { x: 1, y: 2 },
            { x: 3, y: 4 },
          ],
          [
            { x: 5, y: 6 },
            { x: 7, y: 8 },
          ],
        ],
      }),
    );
    expect(stream).toContain('1 2 m');
    expect(stream).toContain('3 4 l');
    expect(stream).toContain('5 6 m');
    expect(stream.match(/S/g)).toHaveLength(2);
  });

  it('turns a single tap into a dot', () => {
    const stream = appearanceStream(annotation('ink', { ink: [[{ x: 1, y: 2 }]] }));
    expect(stream).toContain('1 2 m');
    expect(stream).toContain('1 2 l');
  });

  it('draws the border of a rectangle inside its box', () => {
    const stream = appearanceStream(
      annotation('rect', { rect: { x: 10, y: 10, width: 100, height: 50 } }),
    );
    expect(stream).toContain('10.75 10.75 98.5 48.5 re');
    expect(stream).toContain('S');
  });

  it('draws an ellipse with four curves', () => {
    const stream = appearanceStream(
      annotation('ellipse', { rect: { x: 10, y: 10, width: 100, height: 50 } }),
    );
    expect(stream.match(/ c$/gm)).toHaveLength(4);
  });

  it('draws the bubble of a note', () => {
    const stream = appearanceStream(
      annotation('note', { rect: { x: 10, y: 700, width: 22, height: 22 } }),
    );
    expect(stream).toContain('B');
    expect(stream).toContain('1 1 1 RG');
  });

  it('draws nothing for an annotation with no geometry', () => {
    expect(appearanceStream(annotation('ink'))).toBe('');
  });
});

describe('numbers for the dictionary', () => {
  it('flattens the quads', () => {
    expect(quadNumbers(annotation('highlight', { quads: QUADS }))).toEqual([
      10, 712, 110, 712, 10, 700, 110, 700,
    ]);
  });

  it('flattens the strokes', () => {
    expect(
      inkNumbers(
        annotation('ink', {
          ink: [
            [
              { x: 1, y: 2 },
              { x: 3, y: 4 },
            ],
          ],
        }),
      ),
    ).toEqual([[1, 2, 3, 4]]);
  });

  it('drops an empty stroke', () => {
    expect(inkNumbers(annotation('ink', { ink: [[], [{ x: 1, y: 2 }]] }))).toHaveLength(1);
  });

  it('writes a box as two corners', () => {
    expect(rectNumbers({ x: 10, y: 20, width: 100, height: 40 })).toEqual([10, 20, 110, 60]);
  });
});
