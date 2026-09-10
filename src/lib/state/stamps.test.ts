import { describe, expect, it } from 'vitest';
import { cleanItem, cleanItems, newStampId } from './stamps.svelte';

const DRAWN = { id: 'a', name: 'Mi firma', kind: 'draw', strokes: '[[[0,0],[1,1]]]', ratio: 0.4 };
const IMAGE = { id: 'b', name: 'Sello', kind: 'image', image: 'data:image/png;base64,AAA', ratio: 0.5 };

describe('cleanItem', () => {
  it('keeps a drawn signature', () => {
    expect(cleanItem(DRAWN)?.kind).toBe('draw');
  });

  it('keeps an imported image', () => {
    expect(cleanItem(IMAGE)?.kind).toBe('image');
  });

  it('refuses a drawing with no strokes', () => {
    expect(cleanItem({ ...DRAWN, strokes: '' })).toBeNull();
  });

  it('refuses an image that is not an image', () => {
    expect(cleanItem({ ...IMAGE, image: 'javascript:alert(1)' })).toBeNull();
  });

  it('refuses an entry with no identifier', () => {
    expect(cleanItem({ ...DRAWN, id: '' })).toBeNull();
  });

  it('refuses something that is not an entry', () => {
    expect(cleanItem('firma')).toBeNull();
    expect(cleanItem(null)).toBeNull();
  });

  it('cuts a name that is too long', () => {
    expect(cleanItem({ ...DRAWN, name: 'x'.repeat(200) })?.name).toHaveLength(40);
  });

  it('falls back for a ratio that is not a number', () => {
    expect(cleanItem({ ...DRAWN, ratio: 'alto' })?.ratio).toBe(0.35);
  });

  it('keeps a ratio inside what can be drawn', () => {
    expect(cleanItem({ ...DRAWN, ratio: 900 })?.ratio).toBe(8);
    expect(cleanItem({ ...DRAWN, ratio: 0 })?.ratio).toBe(0.02);
  });
});

describe('cleanItems', () => {
  it('keeps the good ones and drops the rest', () => {
    expect(cleanItems([DRAWN, 'roto', IMAGE])).toHaveLength(2);
  });

  it('gives nothing for something that is not a list', () => {
    expect(cleanItems({})).toEqual([]);
  });

  it('does not keep more than the catalogue holds', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ ...DRAWN, id: `x${i}` }));
    expect(cleanItems(many)).toHaveLength(24);
  });
});

describe('newStampId', () => {
  it('gives a different identifier every time', () => {
    expect(newStampId()).not.toBe(newStampId());
  });
});
