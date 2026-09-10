import { describe, expect, it } from 'vitest';
import { fullPage, MAX_PIXELS, needsTile, pixelsOf, sameBox, tileFor } from './tiles';

const PAGE = { x: 0, y: 0, width: 2000, height: 3000 };

describe('pixelsOf', () => {
  it('counts the pixels of the canvas', () => {
    expect(pixelsOf({ x: 0, y: 0, width: 100, height: 200 }, 2)).toBe(80000);
  });
});

describe('needsTile', () => {
  it('says no for a page that fits', () => {
    expect(needsTile({ x: 0, y: 0, width: 600, height: 800 }, 1)).toBe(false);
  });

  it('says yes for a page blown up', () => {
    expect(needsTile(PAGE, 2)).toBe(true);
  });

  it('takes the limit that is given', () => {
    expect(needsTile({ x: 0, y: 0, width: 600, height: 800 }, 1, 1000)).toBe(true);
  });

  it('uses the usual limit by default', () => {
    const side = Math.sqrt(MAX_PIXELS);
    expect(needsTile({ x: 0, y: 0, width: side - 1, height: side - 1 }, 1)).toBe(false);
  });
});

describe('tileFor', () => {
  it('covers what is on screen', () => {
    const tile = tileFor(PAGE, { x: 300, y: 900, width: 800, height: 600 });
    expect(tile.x).toBeLessThanOrEqual(300);
    expect(tile.y).toBeLessThanOrEqual(900);
    expect(tile.x + tile.width).toBeGreaterThanOrEqual(1100);
    expect(tile.y + tile.height).toBeGreaterThanOrEqual(1500);
  });

  it('snaps to the grid so scrolling does not redraw all the time', () => {
    const one = tileFor(PAGE, { x: 300, y: 900, width: 800, height: 600 });
    const two = tileFor(PAGE, { x: 310, y: 905, width: 800, height: 600 });
    expect(sameBox(one, two)).toBe(true);
  });

  it('stays inside the page', () => {
    const tile = tileFor(PAGE, { x: -500, y: -500, width: 400, height: 400 });
    expect(tile.x).toBe(0);
    expect(tile.y).toBe(0);
  });

  it('does not run past the far edge', () => {
    const tile = tileFor(PAGE, { x: 1900, y: 2900, width: 800, height: 600 });
    expect(tile.x + tile.width).toBe(2000);
    expect(tile.y + tile.height).toBe(3000);
  });

  it('gives an empty tile for a view that misses the page', () => {
    const tile = tileFor(PAGE, { x: 5000, y: 5000, width: 100, height: 100 });
    expect(tile.width).toBe(0);
  });
});

describe('sameBox', () => {
  it('sees two equal boxes', () => {
    expect(sameBox({ x: 1, y: 2, width: 3, height: 4 }, { x: 1, y: 2, width: 3, height: 4 })).toBe(
      true,
    );
  });

  it('sees a box that moved', () => {
    expect(sameBox({ x: 1, y: 2, width: 3, height: 4 }, { x: 9, y: 2, width: 3, height: 4 })).toBe(
      false,
    );
  });

  it('compares nothing with something', () => {
    expect(sameBox(null, { x: 1, y: 2, width: 3, height: 4 })).toBe(false);
    expect(sameBox(null, null)).toBe(true);
  });
});

describe('fullPage', () => {
  it('covers the whole page', () => {
    expect(fullPage(PAGE)).toEqual({ x: 0, y: 0, width: 2000, height: 3000 });
  });
});
