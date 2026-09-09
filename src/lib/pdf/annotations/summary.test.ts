import { describe, expect, it } from 'vitest';
import { rectToQuad } from './geometry';
import type { Annotation, AnnotationKind } from './model';
import { excerptOf, labelFor, pagesWithQuads, sortForList, textInQuads } from './summary';

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

function item(str: string, x: number, y: number, width: number, size = 11) {
  return { str, transform: [size, 0, 0, size, x, y], width, height: size };
}

describe('textInQuads', () => {
  const quads = [rectToQuad({ x: 60, y: 668, width: 200, height: 13 })];

  it('reads the text under the quad', () => {
    const items = [item('Primera linea', 60, 670, 200), item('Otra linea', 60, 640, 200)];
    expect(textInQuads(items, quads)).toBe('Primera linea');
  });

  it('joins the pieces of the same line', () => {
    const items = [item('Primera ', 60, 670, 60), item('linea', 120, 670, 60)];
    expect(textInQuads(items, quads)).toBe('Primera linea');
  });

  it('leaves out a piece that only touches the edge', () => {
    const items = [item('Fuera', 250, 670, 200)];
    expect(textInQuads(items, quads)).toBe('');
  });

  it('ignores pieces with no text', () => {
    expect(textInQuads([item('   ', 60, 670, 200)], quads)).toBe('');
  });

  it('ignores what is not a text item', () => {
    expect(textInQuads([{ str: 'x' }, { transform: [1, 2] }], quads)).toBe('');
  });

  it('gives nothing when there are no quads', () => {
    expect(textInQuads([item('Primera', 60, 670, 200)], [])).toBe('');
  });
});

describe('sortForList', () => {
  it('sorts by page', () => {
    const list = [
      annotation('note', { id: 'b', page: 3, rect: { x: 0, y: 0, width: 10, height: 10 } }),
      annotation('note', { id: 'a', page: 1, rect: { x: 0, y: 0, width: 10, height: 10 } }),
    ];
    expect(sortForList(list).map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('sorts from the top of the page down', () => {
    const list = [
      annotation('note', { id: 'low', rect: { x: 0, y: 100, width: 10, height: 10 } }),
      annotation('note', { id: 'high', rect: { x: 0, y: 700, width: 10, height: 10 } }),
    ];
    expect(sortForList(list).map((a) => a.id)).toEqual(['high', 'low']);
  });

  it('sorts from left to right within a line', () => {
    const list = [
      annotation('note', { id: 'right', rect: { x: 300, y: 700, width: 10, height: 10 } }),
      annotation('note', { id: 'left', rect: { x: 60, y: 700, width: 10, height: 10 } }),
    ];
    expect(sortForList(list).map((a) => a.id)).toEqual(['left', 'right']);
  });

  it('leaves the original list alone', () => {
    const list = [
      annotation('note', { id: 'b', page: 2, rect: { x: 0, y: 0, width: 10, height: 10 } }),
      annotation('note', { id: 'a', page: 1, rect: { x: 0, y: 0, width: 10, height: 10 } }),
    ];
    sortForList(list);
    expect(list[0]?.id).toBe('b');
  });
});

describe('excerptOf', () => {
  it('collapses the spaces', () => {
    expect(excerptOf('  dos   palabras ')).toBe('dos palabras');
  });

  it('cuts a long text', () => {
    expect(excerptOf('a'.repeat(200), 10)).toHaveLength(10);
  });

  it('marks that it was cut', () => {
    expect(excerptOf('a'.repeat(200), 10).endsWith('…')).toBe(true);
  });
});

describe('labelFor', () => {
  it('prefers the comment', () => {
    const note = annotation('note', { contents: 'mi comentario' });
    expect(labelFor(note, 'texto debajo', 'Nota')).toBe('mi comentario');
  });

  it('falls back to the text underneath', () => {
    expect(labelFor(annotation('highlight'), 'texto debajo', 'Resaltado')).toBe('texto debajo');
  });

  it('falls back to the kind', () => {
    expect(labelFor(annotation('ink'), null, 'Dibujo')).toBe('Dibujo');
  });
});

describe('pagesWithQuads', () => {
  it('lists the pages that need their text read', () => {
    const quads = [rectToQuad({ x: 0, y: 0, width: 10, height: 10 })];
    const list = [
      annotation('highlight', { page: 4, quads }),
      annotation('ink', { page: 2, ink: [[{ x: 0, y: 0 }]] }),
      annotation('underline', { page: 1, quads }),
    ];
    expect(pagesWithQuads(list)).toEqual([1, 4]);
  });

  it('gives nothing when nothing has quads', () => {
    expect(pagesWithQuads([annotation('note')])).toEqual([]);
  });
});
