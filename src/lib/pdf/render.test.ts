import { describe, expect, it } from 'vitest';
import type { PageSize } from './document';
import {
  canvasSize,
  clampScale,
  createPageRenderer,
  MAX_SCALE,
  MIN_SCALE,
  nextZoomStep,
  releaseCanvas,
  rotatedSize,
  scaleFor,
} from './render';

const A4: PageSize = { width: 600, height: 800, rotation: 0 };
const LANDSCAPE: PageSize = { width: 800, height: 600, rotation: 0 };
const TURNED: PageSize = { width: 600, height: 800, rotation: 90 };

describe('clampScale', () => {
  it('leaves a sensible scale alone', () => {
    expect(clampScale(1.5)).toBe(1.5);
  });

  it('refuses to go below the minimum', () => {
    expect(clampScale(0.001)).toBe(MIN_SCALE);
  });

  it('refuses to go above the maximum', () => {
    expect(clampScale(50)).toBe(MAX_SCALE);
  });

  it('falls back to one for a value that is not a number', () => {
    expect(clampScale(Number.NaN)).toBe(1);
  });
});

describe('rotatedSize', () => {
  it('leaves an upright page alone', () => {
    expect(rotatedSize(A4, 0)).toEqual({ width: 600, height: 800 });
  });

  it('swaps the sides at a quarter turn', () => {
    expect(rotatedSize(A4, 90)).toEqual({ width: 800, height: 600 });
  });

  it('leaves them swapped at three quarters', () => {
    expect(rotatedSize(A4, 270)).toEqual({ width: 800, height: 600 });
  });

  it('returns to upright at half a turn', () => {
    expect(rotatedSize(A4, 180)).toEqual({ width: 600, height: 800 });
  });

  it('adds the rotation the document already had', () => {
    expect(rotatedSize(TURNED, 0)).toEqual({ width: 800, height: 600 });
  });

  it('cancels the two rotations when they add up to a full turn', () => {
    expect(rotatedSize(TURNED, 270)).toEqual({ width: 600, height: 800 });
  });
});

describe('scaleFor', () => {
  const viewport = { width: 1200, height: 900 };

  it('uses a fixed zoom as it comes', () => {
    expect(scaleFor(A4, 2, viewport)).toBe(2);
  });

  it('clamps a fixed zoom that is out of range', () => {
    expect(scaleFor(A4, 99, viewport)).toBe(MAX_SCALE);
  });

  it('fits the width', () => {
    expect(scaleFor(A4, 'fit-width', viewport)).toBe(2);
  });

  it('takes the padding off the width', () => {
    expect(scaleFor(A4, 'fit-width', viewport, 0, 100)).toBeCloseTo(1000 / 600, 5);
  });

  it('fits the whole page by its tighter side', () => {
    expect(scaleFor(A4, 'fit-page', viewport)).toBeCloseTo(900 / 800, 5);
  });

  it('fits a landscape page by its width', () => {
    expect(scaleFor(LANDSCAPE, 'fit-page', viewport)).toBeCloseTo(900 / 600, 5);
  });

  it('takes the rotation into account when fitting', () => {
    expect(scaleFor(A4, 'fit-width', viewport, 90)).toBeCloseTo(1200 / 800, 5);
  });

  it('returns one for a page with no size', () => {
    expect(scaleFor({ width: 0, height: 0, rotation: 0 }, 'fit-width', viewport)).toBe(1);
  });

  it('survives a viewport of zero', () => {
    expect(scaleFor(A4, 'fit-width', { width: 0, height: 0 })).toBeGreaterThan(0);
  });
});

describe('canvasSize', () => {
  it('scales the page for the layout', () => {
    const size = canvasSize(A4, 2, 0, 1);
    expect(size.cssWidth).toBe(1200);
    expect(size.cssHeight).toBe(1600);
  });

  it('multiplies the pixels by the screen density', () => {
    const size = canvasSize(A4, 1, 0, 2);
    expect(size.pixelWidth).toBe(1200);
    expect(size.cssWidth).toBe(600);
  });

  it('never asks for more than three times the density', () => {
    expect(canvasSize(A4, 1, 0, 9).pixelWidth).toBe(1800);
  });

  it('treats a density below one as one', () => {
    expect(canvasSize(A4, 1, 0, 0.5).pixelWidth).toBe(600);
  });

  it('swaps the sides when the page is turned', () => {
    expect(canvasSize(A4, 1, 90, 1).cssWidth).toBe(800);
  });

  it('never returns a canvas of zero', () => {
    const size = canvasSize({ width: 0, height: 0, rotation: 0 }, 1, 0, 1);
    expect(size.cssWidth).toBeGreaterThan(0);
    expect(size.pixelHeight).toBeGreaterThan(0);
  });
});

describe('nextZoomStep', () => {
  it('goes up to the next step', () => {
    expect(nextZoomStep(1, 1)).toBe(1.25);
  });

  it('goes down to the previous step', () => {
    expect(nextZoomStep(1, -1)).toBe(0.75);
  });

  it('jumps to the next step from a value in between', () => {
    expect(nextZoomStep(1.1, 1)).toBe(1.25);
  });

  it('stops at the maximum', () => {
    expect(nextZoomStep(MAX_SCALE, 1)).toBe(MAX_SCALE);
  });

  it('stops at the minimum', () => {
    expect(nextZoomStep(0.25, -1)).toBe(MIN_SCALE);
  });
});

describe('releaseCanvas', () => {
  it('frees the pixels of a canvas that left the window', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    releaseCanvas(canvas);
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });
});

describe('createPageRenderer', () => {
  function fakePage(rotate = 0) {
    const calls: Array<{ scale: number; rotation: number }> = [];
    return {
      calls,
      rotate,
      getViewport({ scale, rotation }: { scale: number; rotation: number }) {
        calls.push({ scale, rotation });
        return { width: 600 * scale, height: 800 * scale };
      },
      render() {
        return { promise: Promise.resolve(), cancel() {} };
      },
    };
  }

  it('never fixes the layout size of the canvas', async () => {
    const canvas = document.createElement('canvas');
    const renderer = createPageRenderer(canvas);
    await renderer.render(fakePage() as never, 2, 0);
    expect(canvas.style.width).toBe('');
    expect(canvas.style.height).toBe('');
  });

  it('sets the bitmap from the zoom', async () => {
    const canvas = document.createElement('canvas');
    await createPageRenderer(canvas).render(fakePage() as never, 2, 0);
    expect(canvas.width).toBeGreaterThan(0);
  });

  it('draws at the rotation it is given, whatever the page says', async () => {
    const page = fakePage(90);
    await createPageRenderer(document.createElement('canvas')).render(page as never, 1, 180);
    expect(page.calls[0]?.rotation).toBe(180);
  });

  it('does not add the rotation of the page a second time', async () => {
    const page = fakePage(90);
    await createPageRenderer(document.createElement('canvas')).render(page as never, 1, 90);
    expect(page.calls[0]?.rotation).toBe(90);
  });
});
