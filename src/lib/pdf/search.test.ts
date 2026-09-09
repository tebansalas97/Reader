import { describe, expect, it, vi } from 'vitest';
import {
  excerpt,
  extractAllText,
  findInPages,
  fold,
  groupByPage,
  joinTextItems,
  type TextSource,
} from './search';

const PAGES = [
  'La primera página habla de canciones y de música.',
  'La segunda menciona la canción otra vez, y la canción de nuevo.',
  'La tercera no dice nada del tema.',
];

describe('fold', () => {
  it('lowercases and strips accents', () => {
    expect(fold('CANCIÓN')).toBe('cancion');
  });

  it('leaves plain text alone', () => {
    expect(fold('texto')).toBe('texto');
  });
});

describe('findInPages', () => {
  it('finds a word across pages', () => {
    const outcome = findInPages(PAGES, 'canción');
    expect(outcome.matches.map((m) => m.page)).toEqual([1, 2, 2]);
  });

  it('ignores accents', () => {
    expect(findInPages(PAGES, 'cancion').matches).toHaveLength(3);
  });

  it('ignores case', () => {
    expect(findInPages(PAGES, 'CANCIONES').matches).toHaveLength(1);
  });

  it('reports where in the page the match sits', () => {
    const first = findInPages(PAGES, 'primera').matches[0];
    expect(first?.index).toBe(PAGES[0]!.indexOf('primera'));
  });

  it('finds several matches on the same page', () => {
    expect(findInPages([PAGES[1]!], 'canción').matches).toHaveLength(2);
  });

  it('returns nothing for a query that is not there', () => {
    expect(findInPages(PAGES, 'zzz').matches).toEqual([]);
  });

  it('returns nothing for an empty query', () => {
    expect(findInPages(PAGES, '   ').matches).toEqual([]);
  });

  it('never loops forever on repeated matches', () => {
    const outcome = findInPages(['aaaa'], 'a');
    expect(outcome.matches).toHaveLength(4);
  });

  it('stops at five hundred matches', () => {
    const outcome = findInPages(['x'.repeat(600)], 'x');
    expect(outcome.matches).toHaveLength(500);
    expect(outcome.truncated).toBe(true);
  });

  it('handles a document with no pages', () => {
    expect(findInPages([], 'x').matches).toEqual([]);
  });
});

describe('excerpt', () => {
  it('returns a short line whole', () => {
    expect(excerpt('una linea corta', 4, 5)).toBe('una linea corta');
  });

  it('marks that it cut the start', () => {
    const long = `${'a'.repeat(200)} objetivo`;
    expect(excerpt(long, 201, 8).startsWith('…')).toBe(true);
  });

  it('marks that it cut the end', () => {
    const long = `objetivo ${'a'.repeat(200)}`;
    expect(excerpt(long, 0, 8).endsWith('…')).toBe(true);
  });

  it('collapses runs of whitespace', () => {
    expect(excerpt('uno    \n   dos', 0, 3)).toBe('uno dos');
  });
});

describe('groupByPage', () => {
  it('gathers the matches of each page', () => {
    const groups = groupByPage(findInPages(PAGES, 'canción').matches);
    expect(groups.map((g) => g.page)).toEqual([1, 2]);
    expect(groups[1]?.items).toHaveLength(2);
  });

  it('returns nothing for no matches', () => {
    expect(groupByPage([])).toEqual([]);
  });
});

describe('joinTextItems', () => {
  it('joins the pieces of a line', () => {
    expect(joinTextItems([{ str: 'hola ' }, { str: 'mundo' }])).toBe('hola mundo');
  });

  it('breaks the line where the pdf says so', () => {
    expect(joinTextItems([{ str: 'uno', hasEOL: true }, { str: 'dos' }])).toBe('uno\ndos');
  });

  it('ignores pieces without text', () => {
    expect(joinTextItems([{ str: 'a' }, {}, { str: 'b' }])).toBe('ab');
  });

  it('returns an empty string for a page with no text', () => {
    expect(joinTextItems([])).toBe('');
  });
});

describe('extractAllText', () => {
  function source(pages: string[]): TextSource & { calls: number } {
    const state = {
      pageCount: pages.length,
      calls: 0,
      async page(index: number) {
        state.calls += 1;
        return {
          async getTextContent() {
            return { items: [{ str: pages[index - 1] ?? '' }] };
          },
        };
      },
    };
    return state;
  }

  it('reads every page', async () => {
    const pages = await extractAllText(source(['uno', 'dos']), new Map());
    expect(pages).toEqual(['uno', 'dos']);
  });

  it('uses the cache instead of reading again', async () => {
    const from = source(['uno', 'dos']);
    const cache = new Map<number, string>();
    await extractAllText(from, cache);
    const before = from.calls;
    await extractAllText(from, cache);
    expect(from.calls).toBe(before);
  });

  it('fills the cache as it goes', async () => {
    const cache = new Map<number, string>();
    await extractAllText(source(['uno']), cache);
    expect(cache.get(1)).toBe('uno');
  });

  it('handles a document with no pages', async () => {
    expect(await extractAllText(source([]), new Map())).toEqual([]);
  });

  it('does not read pages it already knows', async () => {
    const from = source(['uno', 'dos']);
    const spy = vi.spyOn(from, 'page');
    await extractAllText(from, new Map([[1, 'cacheado']]));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
