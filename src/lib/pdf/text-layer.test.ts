import { describe, expect, it } from 'vitest';
import { viewportTransform } from './annotations/geometry';
import type { PageSize } from './document';
import { pieceFrom, piecesFrom, scaleXFor, styleFor } from './text-layer';

const A4: PageSize = { width: 600, height: 800, rotation: 0 };

function item(overrides: Record<string, unknown> = {}) {
  return { str: 'hola', transform: [12, 0, 0, 12, 50, 700], width: 40, ...overrides };
}

function matrix(scale = 1, rotation = 0, size: PageSize = A4) {
  return viewportTransform(size, scale, rotation);
}

describe('pieceFrom', () => {
  it('keeps the text', () => {
    expect(pieceFrom(item(), matrix(), 1)?.text).toBe('hola');
  });

  it('places it from the left of the page', () => {
    expect(pieceFrom(item(), matrix(), 1)?.left).toBe(50);
  });

  it('flips the vertical origin of the pdf', () => {
    expect(pieceFrom(item(), matrix(), 1)?.top).toBe(800 - 712);
  });

  it('takes the height from the font matrix', () => {
    expect(pieceFrom(item(), matrix(), 1)?.height).toBe(12);
  });

  it('scales every measure', () => {
    const piece = pieceFrom(item(), matrix(2), 2);
    expect(piece?.left).toBe(100);
    expect(piece?.height).toBe(24);
    expect(piece?.width).toBe(80);
  });

  it('reports the rotation of slanted text', () => {
    const piece = pieceFrom(item({ transform: [0, 12, -12, 0, 50, 700] }), matrix(), 1);
    expect(piece?.angle).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('turns upright text sideways when the page is turned', () => {
    const piece = pieceFrom(item(), matrix(1, 90), 1);
    expect(piece?.angle).toBeCloseTo(Math.PI / 2, 5);
  });

  it('follows the page when it is turned', () => {
    const piece = pieceFrom(item(), matrix(1, 90), 1)!;
    expect(piece.left).toBeCloseTo(700 + 12, 5);
    expect(piece.top).toBeCloseTo(50, 5);
  });

  it('drops a piece with no text', () => {
    expect(pieceFrom(item({ str: '   ' }), matrix(), 1)).toBeNull();
  });

  it('drops a piece that is not text at all', () => {
    expect(pieceFrom(item({ str: 42 }), matrix(), 1)).toBeNull();
  });

  it('drops a piece with no position', () => {
    expect(pieceFrom(item({ transform: undefined }), matrix(), 1)).toBeNull();
  });

  it('drops a piece with a short transform', () => {
    expect(pieceFrom(item({ transform: [1, 2, 3] }), matrix(), 1)).toBeNull();
  });

  it('never returns a height of zero', () => {
    const piece = pieceFrom(item({ transform: [0, 0, 0, 0, 10, 10] }), matrix(), 1);
    expect(piece?.height).toBeGreaterThan(0);
  });

  it('never returns a negative width', () => {
    expect(pieceFrom(item({ width: -20 }), matrix(), 1)?.width).toBe(0);
  });
});

describe('piecesFrom', () => {
  it('keeps only the pieces that have text', () => {
    const pieces = piecesFrom([item(), item({ str: ' ' }), item({ str: 'dos' })], A4, 1, 0);
    expect(pieces.map((p) => p.text)).toEqual(['hola', 'dos']);
  });

  it('returns nothing for a page with no text', () => {
    expect(piecesFrom([], A4, 1, 0)).toEqual([]);
  });

  it('places the text of a page that is already turned', () => {
    const turned: PageSize = { width: 600, height: 800, rotation: 90 };
    const [piece] = piecesFrom([item()], turned, 1, 0);
    expect(piece?.angle).toBeCloseTo(Math.PI / 2, 5);
  });
});

describe('scaleXFor', () => {
  it('stretches the piece to the width the pdf says', () => {
    expect(scaleXFor(80, 40)).toBe(2);
  });

  it('leaves it alone when there is nothing to measure', () => {
    expect(scaleXFor(80, 0)).toBe(1);
  });

  it('leaves it alone when the pdf gives no width', () => {
    expect(scaleXFor(0, 40)).toBe(1);
  });

  it('leaves it alone for a measure that is not a number', () => {
    expect(scaleXFor(80, Number.NaN)).toBe(1);
  });
});

describe('styleFor', () => {
  it('writes the position and size', () => {
    const style = styleFor(pieceFrom(item(), matrix(), 1)!);
    expect(style).toContain('left: 50.00px');
    expect(style).toContain('font-size: 12.00px');
  });

  it('leaves out the rotation for upright text', () => {
    expect(styleFor(pieceFrom(item(), matrix(), 1)!)).not.toContain('rotate');
  });

  it('includes the rotation for slanted text', () => {
    const piece = pieceFrom(item({ transform: [0, 12, -12, 0, 50, 700] }), matrix(), 1)!;
    expect(styleFor(piece)).toContain('rotate');
  });

  it('leaves out the stretch when there is none', () => {
    expect(styleFor(pieceFrom(item(), matrix(), 1)!, 1)).not.toContain('scaleX');
  });

  it('writes the stretch when the piece has to be squeezed', () => {
    expect(styleFor(pieceFrom(item(), matrix(), 1)!, 0.5)).toContain('scaleX(0.5000)');
  });
});
