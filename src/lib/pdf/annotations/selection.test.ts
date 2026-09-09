import { describe, expect, it } from 'vitest';
import { rectToQuad } from './geometry';
import {
  bigEnough,
  createAnnotation,
  dragRect,
  groupByPage,
  HIGHLIGHT_OPACITY,
  opacityFor,
  pageOfRect,
  simplify,
  type PageBox,
} from './selection';

const PAGES: PageBox[] = [
  { page: 1, rect: { left: 0, top: 0, width: 600, height: 800 } },
  { page: 2, rect: { left: 0, top: 820, width: 600, height: 800 } },
];

describe('opacityFor', () => {
  it('makes a highlight see through', () => {
    expect(opacityFor('highlight')).toBe(HIGHLIGHT_OPACITY);
  });

  it('leaves the rest opaque', () => {
    expect(opacityFor('underline')).toBe(1);
  });
});

describe('createAnnotation', () => {
  const quads = [rectToQuad({ x: 10, y: 700, width: 100, height: 12 })];

  it('makes a highlight from a selection', () => {
    const annotation = createAnnotation({
      kind: 'highlight',
      page: 2,
      color: '#ff0000',
      author: 'Esteban',
      quads,
    })!;
    expect(annotation.kind).toBe('highlight');
    expect(annotation.page).toBe(2);
    expect(annotation.color).toBe('#ff0000');
    expect(annotation.author).toBe('Esteban');
    expect(annotation.origin).toBe('reader');
    expect(annotation.quads).toEqual(quads);
  });

  it('marks the moment it was made', () => {
    const before = Date.now();
    const annotation = createAnnotation({
      kind: 'highlight',
      page: 1,
      color: '#ff0000',
      author: '',
      quads,
    })!;
    expect(annotation.createdMs).toBeGreaterThanOrEqual(before);
  });

  it('gives every annotation its own identifier', () => {
    const draft = { kind: 'highlight' as const, page: 1, color: '#ff0000', author: '', quads };
    expect(createAnnotation(draft)!.id).not.toBe(createAnnotation(draft)!.id);
  });

  it('refuses a highlight with no quads', () => {
    expect(createAnnotation({ kind: 'highlight', page: 1, color: '#000', author: '' })).toBeNull();
  });

  it('refuses a drawing with no strokes', () => {
    expect(createAnnotation({ kind: 'ink', page: 1, color: '#000', author: '' })).toBeNull();
  });

  it('refuses a rectangle with no box', () => {
    expect(createAnnotation({ kind: 'rect', page: 1, color: '#000', author: '' })).toBeNull();
  });
});

describe('pageOfRect', () => {
  it('finds the page a rectangle sits on', () => {
    expect(pageOfRect({ left: 10, top: 10, width: 100, height: 12 }, PAGES)).toBe(1);
  });

  it('finds the second page', () => {
    expect(pageOfRect({ left: 10, top: 900, width: 100, height: 12 }, PAGES)).toBe(2);
  });

  it('gives nothing for a rectangle in the gap between pages', () => {
    expect(pageOfRect({ left: 10, top: 805, width: 100, height: 4 }, PAGES)).toBeNull();
  });
});

describe('groupByPage', () => {
  it('splits a selection that crosses two pages', () => {
    const grouped = groupByPage(
      [
        { left: 10, top: 700, width: 100, height: 12 },
        { left: 10, top: 900, width: 100, height: 12 },
      ],
      PAGES,
    );
    expect([...grouped.keys()]).toEqual([1, 2]);
  });

  it('keeps several lines of the same page together', () => {
    const grouped = groupByPage(
      [
        { left: 10, top: 700, width: 100, height: 12 },
        { left: 10, top: 720, width: 100, height: 12 },
      ],
      PAGES,
    );
    expect(grouped.get(1)).toHaveLength(2);
  });

  it('drops the empty rectangles', () => {
    const grouped = groupByPage([{ left: 10, top: 700, width: 0, height: 0 }], PAGES);
    expect(grouped.size).toBe(0);
  });

  it('drops what falls outside every page', () => {
    const grouped = groupByPage([{ left: 10, top: 5000, width: 10, height: 10 }], PAGES);
    expect(grouped.size).toBe(0);
  });
});

describe('dragRect', () => {
  it('makes a box from two corners', () => {
    expect(dragRect({ x: 10, y: 10 }, { x: 60, y: 40 })).toEqual({
      x: 10,
      y: 10,
      width: 50,
      height: 30,
    });
  });

  it('works dragging up and to the left', () => {
    expect(dragRect({ x: 60, y: 40 }, { x: 10, y: 10 })).toEqual({
      x: 10,
      y: 10,
      width: 50,
      height: 30,
    });
  });

  it('rejects a box too small to be meant', () => {
    expect(bigEnough(dragRect({ x: 10, y: 10 }, { x: 12, y: 12 }))).toBe(false);
  });

  it('accepts a box big enough', () => {
    expect(bigEnough(dragRect({ x: 10, y: 10 }, { x: 60, y: 40 }))).toBe(true);
  });
});

describe('simplify', () => {
  it('drops the points that add nothing', () => {
    const stroke = [
      { x: 0, y: 0 },
      { x: 0.1, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(simplify(stroke)).toHaveLength(2);
  });

  it('keeps the last point of the stroke', () => {
    const stroke = [
      { x: 0, y: 0 },
      { x: 0.1, y: 0 },
      { x: 0.2, y: 0 },
    ];
    expect(simplify(stroke)[1]).toEqual({ x: 0.2, y: 0 });
  });

  it('leaves a short stroke alone', () => {
    const stroke = [{ x: 0, y: 0 }];
    expect(simplify(stroke)).toEqual(stroke);
  });
});
