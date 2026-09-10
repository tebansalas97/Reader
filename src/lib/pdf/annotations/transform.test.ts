import { describe, expect, it } from 'vitest';
import { quadBounds, rectToQuad } from './geometry';
import { boundsOf, type Annotation, type AnnotationKind } from './model';
import {
  angleBetween,
  boundsFrom,
  canEdit,
  canResize,
  canRotate,
  centreOf,
  MIN_SIZE,
  movedBy,
  rotatedAround,
  scaledInto,
} from './transform';

function annotation(kind: AnnotationKind, extra: Partial<Annotation> = {}): Annotation {
  return {
    id: 'a1',
    page: 1,
    kind,
    color: '#ffd400',
    opacity: 1,
    contents: '',
    author: '',
    createdMs: 0,
    origin: 'reader',
    ...extra,
  };
}

const HIGHLIGHT = annotation('highlight', {
  quads: [rectToQuad({ x: 10, y: 700, width: 100, height: 12 })],
});

const INK = annotation('ink', {
  ink: [
    [
      { x: 10, y: 10 },
      { x: 30, y: 40 },
    ],
  ],
});

const BOX = annotation('rect', { rect: { x: 10, y: 10, width: 100, height: 50 } });

describe('what each annotation allows', () => {
  it('lets a shape be resized', () => {
    expect(canResize(BOX)).toBe(true);
  });

  it('keeps the note icon at its size', () => {
    expect(canResize(annotation('note'))).toBe(false);
  });

  it('lets a highlight be turned, because its quads can be', () => {
    expect(canRotate(HIGHLIGHT)).toBe(true);
  });

  it('lets a drawing be turned', () => {
    expect(canRotate(INK)).toBe(true);
  });

  it('does not turn a rectangle, which a PDF stores upright', () => {
    expect(canRotate(BOX)).toBe(false);
    expect(canRotate(annotation('ellipse', { rect: { x: 0, y: 0, width: 1, height: 1 } }))).toBe(
      false,
    );
  });

  it('lets an image of ours be moved, stretched and turned', () => {
    const stamp = annotation('stamp', { quads: HIGHLIGHT.quads, image: 'data:image/png;base64,AA' });
    expect(canEdit(stamp)).toBe(true);
    expect(canResize(stamp)).toBe(true);
    expect(canRotate(stamp)).toBe(true);
  });

  it('deja mover y estirar una imagen que ya estaba en el archivo', () => {
    const stamp = annotation('stamp', { quads: HIGHLIGHT.quads, origin: 'file', ref: '9R' });
    expect(canEdit(stamp)).toBe(true);
    expect(canResize(stamp)).toBe(true);
    expect(movedBy(stamp, 10, 10)).not.toBe(stamp);
  });

  it('no deja girar una imagen que ya estaba en el archivo', () => {
    const stamp = annotation('stamp', { quads: HIGHLIGHT.quads, origin: 'file', ref: '9R' });
    expect(canRotate(stamp)).toBe(false);
  });
});

describe('movedBy', () => {
  it('moves the quads of a highlight', () => {
    const moved = movedBy(HIGHLIGHT, 5, -20);
    expect(quadBounds(moved.quads![0]!)).toEqual({ x: 15, y: 680, width: 100, height: 12 });
  });

  it('moves every point of a drawing', () => {
    expect(movedBy(INK, 5, 5).ink![0]).toEqual([
      { x: 15, y: 15 },
      { x: 35, y: 45 },
    ]);
  });

  it('moves the box of a shape', () => {
    expect(movedBy(BOX, -10, 10).rect).toEqual({ x: 0, y: 20, width: 100, height: 50 });
  });

  it('moves a note', () => {
    const note = annotation('note', { rect: { x: 10, y: 10, width: 22, height: 22 } });
    expect(movedBy(note, 4, 4).rect).toEqual({ x: 14, y: 14, width: 22, height: 22 });
  });

  it('gives back the same annotation when nothing moves', () => {
    expect(movedBy(HIGHLIGHT, 0, 0)).toBe(HIGHLIGHT);
  });

  it('leaves the rest of the annotation alone', () => {
    const moved = movedBy(HIGHLIGHT, 5, 5);
    expect(moved.id).toBe(HIGHLIGHT.id);
    expect(moved.color).toBe(HIGHLIGHT.color);
    expect(moved.ref).toBe(HIGHLIGHT.ref);
  });
});

describe('scaledInto', () => {
  it('stretches a shape into its new box', () => {
    const from = boundsOf(BOX)!;
    const scaled = scaledInto(BOX, from, { x: 10, y: 10, width: 200, height: 100 });
    expect(scaled.rect).toEqual({ x: 10, y: 10, width: 200, height: 100 });
  });

  it('stretches the strokes of a drawing', () => {
    const from = boundsOf(INK)!;
    const scaled = scaledInto(INK, from, { x: 0, y: 0, width: 40, height: 60 });
    expect(scaled.ink![0]).toEqual([
      { x: 0, y: 0 },
      { x: 40, y: 60 },
    ]);
  });

  it('stretches the quads of a highlight', () => {
    const from = boundsOf(HIGHLIGHT)!;
    const scaled = scaledInto(HIGHLIGHT, from, { x: 10, y: 700, width: 50, height: 12 });
    expect(quadBounds(scaled.quads![0]!).width).toBe(50);
  });

  it('leaves a note at its size', () => {
    const note = annotation('note', { rect: { x: 10, y: 10, width: 22, height: 22 } });
    expect(scaledInto(note, boundsOf(note)!, { x: 0, y: 0, width: 90, height: 90 })).toBe(note);
  });

  it('survives a box with no size', () => {
    expect(scaledInto(BOX, { x: 0, y: 0, width: 0, height: 0 }, { x: 0, y: 0, width: 5, height: 5 })).toBe(
      BOX,
    );
  });
});

describe('rotatedAround', () => {
  it('turns a drawing a quarter turn', () => {
    const turned = rotatedAround(
      annotation('ink', {
        ink: [
          [
            { x: 10, y: 0 },
            { x: 20, y: 0 },
          ],
        ],
      }),
      { x: 0, y: 0 },
      Math.PI / 2,
    );
    expect(turned.ink![0]![0]!.x).toBeCloseTo(0, 6);
    expect(turned.ink![0]![0]!.y).toBeCloseTo(10, 6);
  });

  it('turns the quads of a highlight into a slanted quad', () => {
    const centre = centreOf(HIGHLIGHT)!;
    const turned = rotatedAround(HIGHLIGHT, centre, Math.PI / 4);
    const quad = turned.quads![0]!;
    expect(quad.y1).not.toBeCloseTo(quad.y2, 3);
  });

  it('comes back to where it was after a full turn', () => {
    const centre = centreOf(HIGHLIGHT)!;
    const turned = rotatedAround(HIGHLIGHT, centre, Math.PI * 2);
    expect(turned.quads![0]!.x1).toBeCloseTo(HIGHLIGHT.quads![0]!.x1, 6);
  });

  it('leaves a rectangle upright', () => {
    expect(rotatedAround(BOX, { x: 0, y: 0 }, 1)).toBe(BOX);
  });
});

describe('boundsFrom', () => {
  it('makes a box between the anchor and the pointer', () => {
    expect(boundsFrom({ x: 10, y: 10 }, { x: 60, y: 40 })).toEqual({
      x: 10,
      y: 10,
      width: 50,
      height: 30,
    });
  });

  it('lets the pointer cross the anchor', () => {
    expect(boundsFrom({ x: 60, y: 40 }, { x: 10, y: 10 })).toEqual({
      x: 10,
      y: 10,
      width: 50,
      height: 30,
    });
  });

  it('never collapses the box', () => {
    const box = boundsFrom({ x: 10, y: 10 }, { x: 10, y: 10 });
    expect(box.width).toBe(MIN_SIZE);
    expect(box.height).toBe(MIN_SIZE);
  });
});

describe('angleBetween', () => {
  it('measures a quarter turn', () => {
    const angle = angleBetween({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 });
    expect(angle).toBeCloseTo(Math.PI / 2, 6);
  });

  it('measures nothing when the pointer does not move', () => {
    expect(angleBetween({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 })).toBeCloseTo(0, 6);
  });
});
