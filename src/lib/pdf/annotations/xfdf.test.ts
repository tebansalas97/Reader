import { describe, expect, it } from 'vitest';
import { fromXfdf, parseXfdfDate, toXfdf, xfdfDate } from './xfdf';
import type { Annotation } from './model';

function base(extra: Partial<Annotation>): Annotation {
  return {
    id: 'a1',
    page: 2,
    kind: 'highlight',
    color: '#ffd400',
    opacity: 0.4,
    contents: '',
    author: 'Esteban',
    createdMs: Date.UTC(2026, 8, 10, 12, 0, 0),
    origin: 'reader',
    ...extra,
  };
}

const HIGHLIGHT = base({
  quads: [{ x1: 10, y1: 100, x2: 110, y2: 100, x3: 110, y3: 88, x4: 10, y4: 88 }],
});

const INK = base({
  kind: 'ink',
  color: '#4dabf7',
  opacity: 1,
  ink: [
    [
      { x: 10, y: 10 },
      { x: 20, y: 30 },
    ],
  ],
});

const NOTE = base({
  kind: 'note',
  contents: 'Con "comillas" & <signos>',
  rect: { x: 40, y: 50, width: 18, height: 18 },
});

describe('xfdfDate', () => {
  it('writes a PDF date in UTC', () => {
    expect(xfdfDate(Date.UTC(2026, 8, 10, 12, 3, 4))).toBe('D:20260910120304Z');
  });

  it('reads back what it wrote', () => {
    const ms = Date.UTC(2026, 8, 10, 12, 3, 4);
    expect(parseXfdfDate(xfdfDate(ms))).toBe(ms);
  });

  it('falls back when the date is missing', () => {
    expect(parseXfdfDate(null)).toBeGreaterThan(0);
  });
});

describe('toXfdf', () => {
  it('numbers the pages from zero', () => {
    expect(toXfdf([HIGHLIGHT])).toContain('page="1"');
  });

  it('writes the quads of a highlight', () => {
    expect(toXfdf([HIGHLIGHT])).toContain('coords="10,100,110,100,10,88,110,88"');
  });

  it('writes the strokes of an ink annotation', () => {
    expect(toXfdf([INK])).toContain('<gesture>10,10;20,30</gesture>');
  });

  it('escapes the comment', () => {
    expect(toXfdf([NOTE])).toContain('Con &quot;comillas&quot; &amp; &lt;signos&gt;');
  });

  it('leaves out a stamp, which XFDF cannot carry', () => {
    const stamp = base({ kind: 'stamp', image: 'data:image/png;base64,AAA', quads: HIGHLIGHT.quads });
    expect(toXfdf([stamp])).not.toContain('<stamp');
  });

  it('names the document it came from', () => {
    expect(toXfdf([HIGHLIGHT], 'C:\docs\a.pdf')).toContain('<f href="C:\docs\a.pdf"/>');
  });
});

describe('fromXfdf', () => {
  it('reads back a highlight without losing it', () => {
    const [back] = fromXfdf(toXfdf([HIGHLIGHT]));
    expect(back?.kind).toBe('highlight');
    expect(back?.page).toBe(2);
    expect(back?.color).toBe('#ffd400');
    expect(back?.quads).toEqual(HIGHLIGHT.quads);
  });

  it('reads back the strokes of an ink annotation', () => {
    const [back] = fromXfdf(toXfdf([INK]));
    expect(back?.ink).toEqual(INK.ink);
  });

  it('reads back a note with its comment', () => {
    const [back] = fromXfdf(toXfdf([NOTE]));
    expect(back?.contents).toBe('Con "comillas" & <signos>');
    expect(back?.rect).toEqual(NOTE.rect);
  });

  it('gives every imported annotation a new identity', () => {
    const [back] = fromXfdf(toXfdf([HIGHLIGHT]));
    expect(back?.id).not.toBe('a1');
    expect(back?.origin).toBe('reader');
  });

  it('keeps the author and the date', () => {
    const [back] = fromXfdf(toXfdf([HIGHLIGHT]));
    expect(back?.author).toBe('Esteban');
    expect(back?.createdMs).toBe(HIGHLIGHT.createdMs);
  });

  it('reads a square and a circle as our shapes', () => {
    const text = `<?xml version="1.0"?><xfdf xmlns="http://ns.adobe.com/xfdf/"><annots>
      <square page="0" rect="10,10,50,40" color="#FF0000"/>
      <circle page="0" rect="10,10,50,40" color="#00FF00"/>
    </annots></xfdf>`;
    expect(fromXfdf(text).map((entry) => entry.kind)).toEqual(['rect', 'ellipse']);
  });

  it('ignores an annotation with no geometry', () => {
    const text = `<?xml version="1.0"?><xfdf xmlns="http://ns.adobe.com/xfdf/"><annots>
      <highlight page="0"/>
    </annots></xfdf>`;
    expect(fromXfdf(text)).toEqual([]);
  });

  it('returns nothing for a file that is not XFDF', () => {
    expect(fromXfdf('no soy xml <<<')).toEqual([]);
  });

  it('survives an empty file', () => {
    expect(fromXfdf('')).toEqual([]);
  });
});
