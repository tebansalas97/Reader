import { describe, expect, it } from 'vitest';
import type { PageSize } from '../document';
import { quadBounds } from './geometry';
import {
  fitInside,
  matrixText,
  pageMatrixOf,
  ratioOf,
  screenMatrixOf,
  stampQuad,
  stampRect,
} from './stamp';

const A4: PageSize = { width: 600, height: 800, rotation: 0 };
const RECT = { x: 100, y: 200, width: 180, height: 60 };

describe('stampRect', () => {
  it('hangs the image from the point that was clicked', () => {
    expect(stampRect({ x: 100, y: 500 }, 180, 0.5)).toEqual({
      x: 100,
      y: 410,
      width: 180,
      height: 90,
    });
  });

  it('never makes an image with no height', () => {
    expect(stampRect({ x: 0, y: 0 }, 180, 0).height).toBeGreaterThan(0);
  });
});

describe('stampQuad', () => {
  it('writes the four corners of the box', () => {
    const quad = stampQuad(RECT);
    expect(quadBounds(quad)).toEqual(RECT);
    expect(quad.y1).toBeGreaterThan(quad.y3);
  });
});

describe('pageMatrixOf', () => {
  it('maps the image onto an upright box', () => {
    expect(pageMatrixOf(stampQuad(RECT))).toEqual([180, 0, 0, 60, 100, 200]);
  });

  it('follows a box that was turned', () => {
    const turned = { x1: 0, y1: 0, x2: 0, y2: 180, x3: 60, y3: 0, x4: 60, y4: 180 };
    const matrix = pageMatrixOf(turned);
    expect(matrix[0]).toBe(0);
    expect(matrix[1]).toBe(180);
    expect(matrix[4]).toBe(60);
  });
});

describe('screenMatrixOf', () => {
  it('puts the top left corner of the image at the top left of the box', () => {
    const matrix = screenMatrixOf(stampQuad(RECT), A4, 1, 0);
    expect(matrix[4]).toBe(100);
    expect(matrix[5]).toBe(800 - 260);
  });

  it('sizes the image with the zoom', () => {
    const matrix = screenMatrixOf(stampQuad(RECT), A4, 2, 0);
    expect(matrix[0]).toBe(360);
    expect(matrix[3]).toBe(120);
  });

  it('follows the page when it is turned', () => {
    const matrix = screenMatrixOf(stampQuad(RECT), A4, 1, 90);
    expect(Math.abs(matrix[0])).toBeCloseTo(0, 6);
    expect(Math.abs(matrix[1])).toBeCloseTo(180, 6);
  });
});

describe('matrixText', () => {
  it('writes the numbers the way a pdf wants them', () => {
    expect(matrixText([180, 0, 0, 60, 100, 200])).toBe('180 0 0 60 100 200');
  });

  it('never writes more than three decimals', () => {
    expect(matrixText([1.23456, 0, 0, 1, 0, 0]).startsWith('1.235')).toBe(true);
  });
});

describe('fitInside', () => {
  it('shrinks an image that is too big', () => {
    expect(fitInside(1200, 600, 600)).toEqual({ x: 0, y: 0, width: 600, height: 300 });
  });

  it('leaves a small one alone', () => {
    expect(fitInside(200, 100, 600)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });

  it('survives an image with no size', () => {
    expect(fitInside(0, 0, 600).width).toBe(600);
  });
});

describe('ratioOf', () => {
  it('measures the height against the width', () => {
    expect(ratioOf(200, 100)).toBe(0.5);
  });

  it('never returns zero', () => {
    expect(ratioOf(200, 0)).toBeGreaterThan(0);
  });

  it('survives a width of zero', () => {
    expect(ratioOf(0, 100)).toBe(1);
  });
});
