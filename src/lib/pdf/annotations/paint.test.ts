import { describe, expect, it } from 'vitest';
import type { PageSize } from '../document';
import { rectToQuad } from './geometry';
import type { Annotation, AnnotationKind } from './model';
import { hitBox, paintAnnotation, paintBox } from './paint';

const A4: PageSize = { width: 600, height: 800, rotation: 0 };

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

const QUADS = [rectToQuad({ x: 10, y: 700, width: 100, height: 12 })];

describe('paintAnnotation', () => {
  it('paints a highlight where the text is', () => {
    const painted = paintAnnotation(annotation('highlight', { quads: QUADS }), A4, 1, 0);
    expect(painted.rects).toEqual([{ x: 10, y: 88, width: 100, height: 12 }]);
  });

  it('follows the zoom', () => {
    const painted = paintAnnotation(annotation('highlight', { quads: QUADS }), A4, 2, 0);
    expect(painted.rects[0]).toEqual({ x: 20, y: 176, width: 200, height: 24 });
  });

  it('follows the rotation of the page', () => {
    const painted = paintAnnotation(annotation('highlight', { quads: QUADS }), A4, 1, 90);
    expect(painted.rects[0]?.width).toBeCloseTo(12, 5);
    expect(painted.rects[0]?.height).toBeCloseTo(100, 5);
  });

  it('paints an underline thinner than the line of text', () => {
    const painted = paintAnnotation(annotation('underline', { quads: QUADS }), A4, 1, 0);
    expect(painted.rects[0]?.height).toBeLessThan(2);
    expect(painted.rects[0]?.y).toBeGreaterThan(98);
  });

  it('paints a strikeout across the middle', () => {
    const painted = paintAnnotation(annotation('strikeout', { quads: QUADS }), A4, 1, 0);
    expect(painted.rects[0]?.y).toBeCloseTo(800 - 700 - 12 * 0.42 - 0.72, 1);
  });

  it('paints every stroke of a drawing', () => {
    const painted = paintAnnotation(
      annotation('ink', {
        ink: [
          [
            { x: 10, y: 700 },
            { x: 20, y: 690 },
          ],
        ],
      }),
      A4,
      1,
      0,
    );
    expect(painted.polylines).toEqual(['10.00,100.00 20.00,110.00']);
  });

  it('makes the pen thicker as the zoom grows', () => {
    const ink = annotation('ink', { ink: [[{ x: 1, y: 1 }]] });
    expect(paintAnnotation(ink, A4, 2, 0).strokeWidth).toBe(4);
  });

  it('paints a rectangle inside its own border', () => {
    const painted = paintAnnotation(
      annotation('rect', { rect: { x: 10, y: 10, width: 100, height: 50 } }),
      A4,
      1,
      0,
    );
    expect(painted.rects[0]).toEqual({ x: 10.75, y: 740.75, width: 98.5, height: 48.5 });
  });

  it('paints an ellipse inside its box', () => {
    const painted = paintAnnotation(
      annotation('ellipse', { rect: { x: 10, y: 10, width: 100, height: 50 } }),
      A4,
      1,
      0,
    );
    expect(painted.ellipse).toEqual({ cx: 60, cy: 765, rx: 49.25, ry: 24.25 });
  });

  it('gives a note the box of its icon', () => {
    const painted = paintAnnotation(
      annotation('note', { rect: { x: 10, y: 700, width: 22, height: 22 } }),
      A4,
      1,
      0,
    );
    expect(painted.note).toEqual({ x: 10, y: 78, width: 22, height: 22 });
  });

  it('paints nothing for an annotation with no geometry', () => {
    const painted = paintAnnotation(annotation('highlight'), A4, 1, 0);
    expect(painted.rects).toEqual([]);
    expect(painted.box).toBeNull();
  });
});

describe('paintBox', () => {
  it('wraps every quad of a highlight', () => {
    const quads = [
      rectToQuad({ x: 10, y: 700, width: 100, height: 12 }),
      rectToQuad({ x: 10, y: 680, width: 200, height: 12 }),
    ];
    expect(paintBox(annotation('highlight', { quads }), A4, 1, 0)).toEqual({
      x: 10,
      y: 88,
      width: 200,
      height: 32,
    });
  });

  it('wraps the strokes of a drawing', () => {
    const box = paintBox(
      annotation('ink', {
        ink: [
          [
            { x: 10, y: 700 },
            { x: 40, y: 660 },
          ],
        ],
      }),
      A4,
      1,
      0,
    );
    expect(box).toEqual({ x: 10, y: 100, width: 30, height: 40 });
  });
});

describe('hitBox', () => {
  it('leaves room around a thin underline so it can be clicked', () => {
    const box = hitBox(annotation('underline', { quads: QUADS }), A4, 1, 0, 4);
    expect(box!.height).toBeGreaterThan(8);
  });

  it('gives nothing for an annotation with no geometry', () => {
    expect(hitBox(annotation('ink'), A4, 1, 0)).toBeNull();
  });
});
