import { describe, expect, it } from 'vitest';
import {
  annotationKey,
  boundsOf,
  newAnnotationId,
  replaceAnnotation,
  sameAnnotation,
  sameAnnotations,
  usesQuads,
  usesRect,
  withoutAnnotation,
  type Annotation,
} from './model';

function make(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: 'a1',
    page: 1,
    kind: 'highlight',
    color: '#ffd54f',
    opacity: 0.4,
    contents: '',
    author: 'Esteban',
    createdMs: 1000,
    quads: [{ x1: 10, y1: 20, x2: 60, y2: 20, x3: 10, y3: 8, x4: 60, y4: 8 }],
    origin: 'reader',
    ...overrides,
  };
}

describe('usesQuads and usesRect', () => {
  it('sends text marks through quads', () => {
    expect(usesQuads('highlight')).toBe(true);
    expect(usesQuads('underline')).toBe(true);
    expect(usesQuads('strikeout')).toBe(true);
  });

  it('sends shapes and notes through a rectangle', () => {
    expect(usesRect('rect')).toBe(true);
    expect(usesRect('ellipse')).toBe(true);
    expect(usesRect('note')).toBe(true);
  });

  it('treats freehand as neither', () => {
    expect(usesQuads('ink')).toBe(false);
    expect(usesRect('ink')).toBe(false);
  });
});

describe('newAnnotationId', () => {
  it('never repeats', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newAnnotationId()));
    expect(ids.size).toBe(200);
  });
});

describe('annotationKey', () => {
  it('ignores the identifier', () => {
    expect(annotationKey(make({ id: 'x' }))).toBe(annotationKey(make({ id: 'y' })));
  });

  it('ignores when it was created', () => {
    expect(annotationKey(make({ createdMs: 1 }))).toBe(annotationKey(make({ createdMs: 999 })));
  });

  it('ignores the case of the colour', () => {
    expect(annotationKey(make({ color: '#FFD54F' }))).toBe(annotationKey(make()));
  });

  it('notices a different page', () => {
    expect(annotationKey(make({ page: 2 }))).not.toBe(annotationKey(make()));
  });

  it('notices a different note text', () => {
    expect(annotationKey(make({ contents: 'hola' }))).not.toBe(annotationKey(make()));
  });

  it('notices moved geometry', () => {
    const moved = make({
      quads: [{ x1: 11, y1: 20, x2: 60, y2: 20, x3: 11, y3: 8, x4: 60, y4: 8 }],
    });
    expect(annotationKey(moved)).not.toBe(annotationKey(make()));
  });

  it('ignores differences below a hundredth of a point', () => {
    const nudged = make({
      quads: [{ x1: 10.0001, y1: 20, x2: 60, y2: 20, x3: 10, y3: 8, x4: 60, y4: 8 }],
    });
    expect(annotationKey(nudged)).toBe(annotationKey(make()));
  });
});

describe('sameAnnotation', () => {
  it('matches two copies', () => {
    expect(sameAnnotation(make(), make())).toBe(true);
  });

  it('separates two different marks', () => {
    expect(sameAnnotation(make(), make({ kind: 'underline' }))).toBe(false);
  });
});

describe('sameAnnotations', () => {
  it('matches two empty lists', () => {
    expect(sameAnnotations([], [])).toBe(true);
  });

  it('notices a new annotation', () => {
    expect(sameAnnotations([make()], [])).toBe(false);
  });

  it('notices a deleted annotation', () => {
    expect(sameAnnotations([], [make()])).toBe(false);
  });

  it('ignores the order of the list', () => {
    const one = make({ id: '1', page: 1 });
    const two = make({ id: '2', page: 2 });
    expect(sameAnnotations([one, two], [two, one])).toBe(true);
  });

  it('notices an edited annotation', () => {
    expect(sameAnnotations([make()], [make({ contents: 'nota' })])).toBe(false);
  });

  it('notices two lists of the same length with different content', () => {
    const a = [make({ id: '1' }), make({ id: '2', page: 2 })];
    const b = [make({ id: '1' }), make({ id: '2', page: 3 })];
    expect(sameAnnotations(a, b)).toBe(false);
  });
});

describe('boundsOf', () => {
  it('returns the rectangle of a shape', () => {
    const rect = { x: 5, y: 6, width: 10, height: 4 };
    expect(boundsOf(make({ kind: 'rect', quads: undefined, rect }))).toEqual(rect);
  });

  it('wraps the quads of a highlight', () => {
    expect(boundsOf(make())).toEqual({ x: 10, y: 8, width: 50, height: 12 });
  });

  it('wraps every stroke of a drawing', () => {
    const ink = make({
      kind: 'ink',
      quads: undefined,
      ink: [
        [
          { x: 0, y: 0 },
          { x: 10, y: 5 },
        ],
        [{ x: -4, y: 20 }],
      ],
    });
    expect(boundsOf(ink)).toEqual({ x: -4, y: 0, width: 14, height: 20 });
  });

  it('returns null when there is no geometry', () => {
    expect(boundsOf(make({ quads: undefined }))).toBeNull();
  });
});

describe('withoutAnnotation and replaceAnnotation', () => {
  it('removes the one asked for', () => {
    const list = [make({ id: '1' }), make({ id: '2' })];
    expect(withoutAnnotation(list, '1').map((a) => a.id)).toEqual(['2']);
  });

  it('leaves the list alone when the identifier is unknown', () => {
    const list = [make({ id: '1' })];
    expect(withoutAnnotation(list, 'z')).toHaveLength(1);
  });

  it('replaces in place without reordering', () => {
    const list = [make({ id: '1' }), make({ id: '2' })];
    const next = replaceAnnotation(list, make({ id: '2', contents: 'nueva' }));
    expect(next.map((a) => a.id)).toEqual(['1', '2']);
    expect(next[1]?.contents).toBe('nueva');
  });
});
