import { describe, expect, it } from 'vitest';
import {
  boundsOfStrokes,
  decodeSignature,
  encodeSignature,
  normalisedStrokes,
  placedStrokes,
  signatureRatio,
  signatureRect,
} from './signature';

const DRAWN = [
  [
    { x: 20, y: 40 },
    { x: 60, y: 10 },
  ],
  [
    { x: 60, y: 10 },
    { x: 100, y: 40 },
  ],
];

describe('boundsOfStrokes', () => {
  it('wraps every point', () => {
    expect(boundsOfStrokes(DRAWN)).toEqual({ x: 20, y: 10, width: 80, height: 30 });
  });

  it('gives nothing for nothing drawn', () => {
    expect(boundsOfStrokes([])).toBeNull();
    expect(boundsOfStrokes([[]])).toBeNull();
  });
});

describe('normalisedStrokes', () => {
  it('brings the drawing into a box of side one', () => {
    const strokes = normalisedStrokes(DRAWN);
    expect(strokes[0]![0]).toEqual({ x: 0, y: 0.375 });
    expect(strokes[1]![1]).toEqual({ x: 1, y: 0.375 });
  });

  it('keeps the shape, not the size', () => {
    const twice = DRAWN.map((stroke) => stroke.map((p) => ({ x: p.x * 2, y: p.y * 2 })));
    expect(normalisedStrokes(twice)).toEqual(normalisedStrokes(DRAWN));
  });

  it('drops an empty stroke', () => {
    expect(normalisedStrokes([[], DRAWN[0]!])).toHaveLength(1);
  });

  it('gives nothing for nothing drawn', () => {
    expect(normalisedStrokes([])).toEqual([]);
  });
});

describe('signatureRatio', () => {
  it('measures how tall the drawing is next to its width', () => {
    expect(signatureRatio(DRAWN)).toBeCloseTo(30 / 80, 5);
  });

  it('falls back for nothing drawn', () => {
    expect(signatureRatio([])).toBe(0.35);
  });

  it('never returns something unusable', () => {
    expect(signatureRatio([[{ x: 1, y: 1 }]])).toBeGreaterThan(0);
  });
});

describe('placedStrokes', () => {
  const unit = [
    [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
  ];

  it('puts the drawing inside the box, with the pdf origin at the bottom', () => {
    const placed = placedStrokes(unit, { x: 100, y: 200, width: 180, height: 60 });
    expect(placed[0]![0]).toEqual({ x: 100, y: 260 });
    expect(placed[0]![1]).toEqual({ x: 280, y: 200 });
  });
});

describe('signatureRect', () => {
  it('hangs the box from the point that was clicked', () => {
    expect(signatureRect({ x: 100, y: 500 }, 180, 0.375)).toEqual({
      x: 100,
      y: 500 - 67.5,
      width: 180,
      height: 67.5,
    });
  });

  it('never makes a box with no height', () => {
    expect(signatureRect({ x: 0, y: 0 }, 180, 0).height).toBeGreaterThan(0);
  });
});

describe('keeping the signature', () => {
  it('comes back the same after being written and read', () => {
    const strokes = normalisedStrokes(DRAWN);
    expect(decodeSignature(encodeSignature(strokes))).toEqual(strokes);
  });

  it('gives nothing for something that is not a signature', () => {
    expect(decodeSignature('roto')).toEqual([]);
    expect(decodeSignature('{}')).toEqual([]);
  });

  it('ignores points that are not numbers', () => {
    expect(decodeSignature('[[["a","b"],[1,2]]]')).toEqual([[{ x: 1, y: 2 }]]);
  });
});
