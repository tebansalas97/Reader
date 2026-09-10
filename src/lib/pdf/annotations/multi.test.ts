import { describe, expect, it } from 'vitest';
import { copiesOf, copyOf, copyable, COPY_OFFSET, movedGroup, toggleSelection } from './multi';
import type { Annotation } from './model';

function note(id: string, extra: Partial<Annotation> = {}): Annotation {
  return {
    id,
    page: 1,
    kind: 'note',
    color: '#ffcc00',
    opacity: 1,
    contents: 'hola',
    author: 'yo',
    createdMs: 1,
    origin: 'reader',
    rect: { x: 10, y: 20, width: 18, height: 18 },
    ...extra,
  };
}

describe('toggleSelection', () => {
  it('replaces the selection with a plain click', () => {
    expect(toggleSelection(['a', 'b'], 'c', false)).toEqual(['c']);
  });

  it('keeps a single click on the same annotation', () => {
    expect(toggleSelection(['a'], 'a', false)).toEqual(['a']);
  });

  it('adds with the modifier', () => {
    expect(toggleSelection(['a'], 'b', true)).toEqual(['a', 'b']);
  });

  it('removes an already chosen one with the modifier', () => {
    expect(toggleSelection(['a', 'b'], 'a', true)).toEqual(['b']);
  });
});

describe('copyOf', () => {
  it('gives the copy a new identity', () => {
    const copy = copyOf(note('a'));
    expect(copy?.id).not.toBe('a');
    expect(copy?.origin).toBe('reader');
  });

  it('offsets the copy so it does not hide the original', () => {
    const copy = copyOf(note('a'));
    expect(copy?.rect?.x).toBe(10 + COPY_OFFSET);
    expect(copy?.rect?.y).toBe(20 - COPY_OFFSET);
  });

  it('keeps the comment', () => {
    expect(copyOf(note('a'))?.contents).toBe('hola');
  });

  it('forgets the object of the original', () => {
    const copy = copyOf(note('a', { origin: 'file', ref: '12 0 R' }));
    expect(copy?.ref).toBeUndefined();
    expect(copy?.origin).toBe('reader');
  });

  it('refuses a stamp that was read back without its image', () => {
    const stamp = note('a', { kind: 'stamp', rect: undefined, quads: [] });
    expect(copyable(stamp)).toBe(false);
    expect(copyOf(stamp)).toBeNull();
  });
});

describe('copiesOf', () => {
  it('copies only what was chosen', () => {
    const made = copiesOf([note('a'), note('b'), note('c')], ['a', 'c']);
    expect(made).toHaveLength(2);
  });

  it('keeps the order of the document', () => {
    const made = copiesOf([note('a'), note('b')], ['b', 'a']);
    expect(made.map((entry) => entry.rect?.x)).toEqual([10 + COPY_OFFSET, 10 + COPY_OFFSET]);
    expect(made).toHaveLength(2);
  });
});

describe('movedGroup', () => {
  it('moves every chosen annotation by the same amount', () => {
    const moved = movedGroup([note('a'), note('b')], ['a', 'b'], 5, -3);
    expect(moved.map((entry) => entry.rect?.x)).toEqual([15, 15]);
    expect(moved.map((entry) => entry.rect?.y)).toEqual([17, 17]);
  });

  it('leaves the rest alone', () => {
    expect(movedGroup([note('a'), note('b')], ['a'], 5, 0)).toHaveLength(1);
  });
});
