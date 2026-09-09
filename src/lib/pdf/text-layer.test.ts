import { describe, expect, it } from 'vitest';
import { pieceFrom, piecesFrom, styleFor } from './text-layer';

function item(overrides: Record<string, unknown> = {}) {
  return { str: 'hola', transform: [12, 0, 0, 12, 50, 700], width: 40, ...overrides };
}

describe('pieceFrom', () => {
  it('keeps the text', () => {
    expect(pieceFrom(item(), 800, 1)?.text).toBe('hola');
  });

  it('places it from the left of the page', () => {
    expect(pieceFrom(item(), 800, 1)?.left).toBe(50);
  });

  it('flips the vertical origin of the pdf', () => {
    expect(pieceFrom(item(), 800, 1)?.top).toBe(800 - 712);
  });

  it('takes the height from the font matrix', () => {
    expect(pieceFrom(item(), 800, 1)?.height).toBe(12);
  });

  it('scales every measure', () => {
    const piece = pieceFrom(item(), 1600, 2);
    expect(piece?.left).toBe(100);
    expect(piece?.height).toBe(24);
    expect(piece?.width).toBe(80);
  });

  it('reports the rotation of slanted text', () => {
    const piece = pieceFrom(item({ transform: [0, 12, -12, 0, 50, 700] }), 800, 1);
    expect(piece?.angle).toBeCloseTo(Math.PI / 2, 5);
  });

  it('drops a piece with no text', () => {
    expect(pieceFrom(item({ str: '   ' }), 800, 1)).toBeNull();
  });

  it('drops a piece that is not text at all', () => {
    expect(pieceFrom(item({ str: 42 }), 800, 1)).toBeNull();
  });

  it('drops a piece with no position', () => {
    expect(pieceFrom(item({ transform: undefined }), 800, 1)).toBeNull();
  });

  it('drops a piece with a short transform', () => {
    expect(pieceFrom(item({ transform: [1, 2, 3] }), 800, 1)).toBeNull();
  });

  it('never returns a height of zero', () => {
    const piece = pieceFrom(item({ transform: [0, 0, 0, 0, 10, 10] }), 800, 1);
    expect(piece?.height).toBeGreaterThan(0);
  });

  it('never returns a negative width', () => {
    expect(pieceFrom(item({ width: -20 }), 800, 1)?.width).toBe(0);
  });
});

describe('piecesFrom', () => {
  it('keeps only the pieces that have text', () => {
    const pieces = piecesFrom([item(), item({ str: ' ' }), item({ str: 'dos' })], 800, 1);
    expect(pieces.map((p) => p.text)).toEqual(['hola', 'dos']);
  });

  it('returns nothing for a page with no text', () => {
    expect(piecesFrom([], 800, 1)).toEqual([]);
  });
});

describe('styleFor', () => {
  it('writes the position and size', () => {
    const style = styleFor(pieceFrom(item(), 800, 1)!);
    expect(style).toContain('left: 50.00px');
    expect(style).toContain('font-size: 12.00px');
  });

  it('leaves out the rotation for upright text', () => {
    expect(styleFor(pieceFrom(item(), 800, 1)!)).not.toContain('rotate');
  });

  it('includes the rotation for slanted text', () => {
    const piece = pieceFrom(item({ transform: [0, 12, -12, 0, 50, 700] }), 800, 1)!;
    expect(styleFor(piece)).toContain('rotate');
  });
});
