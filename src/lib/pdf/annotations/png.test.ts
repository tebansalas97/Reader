import { describe, expect, it } from 'vitest';
import { bytesToDataUrl, inkBounds, looksLikePng } from './png';

const HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe('looksLikePng', () => {
  it('knows a png by its head', () => {
    expect(looksLikePng(new Uint8Array([...HEAD, 1, 2, 3]))).toBe(true);
  });

  it('turns down a jpeg', () => {
    expect(looksLikePng(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))).toBe(false);
  });

  it('turns down something too short to tell', () => {
    expect(looksLikePng(new Uint8Array([0x89, 0x50]))).toBe(false);
  });
});

describe('bytesToDataUrl', () => {
  it('writes a data url a browser can show', () => {
    const url = bytesToDataUrl(new Uint8Array([...HEAD]));
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    expect(atob(url.slice('data:image/png;base64,'.length)).length).toBe(8);
  });

  it('survives a picture bigger than one chunk', () => {
    const big = new Uint8Array(100000).fill(65);
    expect(bytesToDataUrl(big).length).toBeGreaterThan(100000);
  });

  it('writes an empty picture without breaking', () => {
    expect(bytesToDataUrl(new Uint8Array())).toBe('data:image/png;base64,');
  });
});

describe('inkBounds', () => {
  function canvas(width: number, height: number, marks: Array<[number, number]>) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (const [x, y] of marks) data[(y * width + x) * 4 + 3] = 255;
    return data;
  }

  it('wraps what was actually drawn', () => {
    const data = canvas(10, 10, [
      [2, 3],
      [6, 7],
    ]);
    expect(inkBounds(data, 10, 10)).toEqual({ x: 2, y: 3, width: 5, height: 5 });
  });

  it('says nothing when the canvas came out empty', () => {
    expect(inkBounds(canvas(10, 10, []), 10, 10)).toBeNull();
  });

  it('ignores what is almost transparent', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    data[3] = 4;
    expect(inkBounds(data, 4, 4)).toBeNull();
  });

  it('takes a single point as a box of one', () => {
    expect(inkBounds(canvas(4, 4, [[1, 1]]), 4, 4)).toEqual({ x: 1, y: 1, width: 1, height: 1 });
  });
});
