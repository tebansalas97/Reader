import { describe, expect, it } from 'vitest';
import { bytesToDataUrl, looksLikePng } from './png';

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
