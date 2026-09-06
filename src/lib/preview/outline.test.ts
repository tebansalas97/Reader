import { describe, expect, it } from 'vitest';
import { activeOutlineIndex, extractOutline } from './outline';

describe('extractOutline', () => {
  it('finds atx headings with their level and line', () => {
    const items = extractOutline('# Uno\n\ntexto\n\n## Dos\n');
    expect(items).toEqual([
      { level: 1, text: 'Uno', line: 0, id: 'uno' },
      { level: 2, text: 'Dos', line: 4, id: 'dos' },
    ]);
  });

  it('ignores hashes inside fenced code blocks', () => {
    const items = extractOutline('```\n# no es título\n```\n\n# Sí\n');
    expect(items.map((i) => i.text)).toEqual(['Sí']);
  });

  it('ignores tilde fenced blocks too', () => {
    expect(extractOutline('~~~\n# no\n~~~\n')).toEqual([]);
  });

  it('strips inline markdown from the heading text', () => {
    expect(extractOutline('# Un **título** con `código`')[0]?.text).toBe('Un título con código');
  });

  it('ignores a hash without a following space', () => {
    expect(extractOutline('#notatitle\n')).toEqual([]);
  });

  it('ignores more than six hashes', () => {
    expect(extractOutline('####### siete\n')).toEqual([]);
  });

  it('strips trailing closing hashes', () => {
    expect(extractOutline('## Dos ##\n')[0]?.text).toBe('Dos');
  });

  it('deduplicates ids', () => {
    expect(extractOutline('# Uno\n\n# Uno\n')[1]?.id).toBe('uno-1');
  });

  it('returns an empty array for a document with no headings', () => {
    expect(extractOutline('solo texto')).toEqual([]);
  });
});

describe('activeOutlineIndex', () => {
  const items = extractOutline('# A\n\n## B\n\n## C\n');

  it('returns the last heading at or above the line', () => {
    expect(activeOutlineIndex(items, 3)).toBe(1);
  });

  it('returns zero before the second heading', () => {
    expect(activeOutlineIndex(items, 0)).toBe(0);
  });

  it('returns the final heading past the end', () => {
    expect(activeOutlineIndex(items, 99)).toBe(2);
  });

  it('returns minus one when there are no items', () => {
    expect(activeOutlineIndex([], 5)).toBe(-1);
  });
});
