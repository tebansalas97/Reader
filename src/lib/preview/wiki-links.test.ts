import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './render';
import { parseWikiLink, wikiCandidates, wikiTargetToFile } from './wiki-links';

describe('parseWikiLink', () => {
  it('reads a plain target', () => {
    expect(parseWikiLink('[[mi nota]]')).toEqual({ target: 'mi nota', label: 'mi nota' });
  });

  it('reads a target with its own label', () => {
    expect(parseWikiLink('[[mi nota|Mi Nota]]')).toEqual({ target: 'mi nota', label: 'Mi Nota' });
  });

  it('trims the spaces around the target', () => {
    expect(parseWikiLink('[[  nota  ]]')?.target).toBe('nota');
  });

  it('rejects an empty target', () => {
    expect(parseWikiLink('[[]]')).toBeNull();
  });

  it('rejects plain text', () => {
    expect(parseWikiLink('sin enlace')).toBeNull();
  });
});

describe('wikiTargetToFile', () => {
  it('adds the markdown extension', () => {
    expect(wikiTargetToFile('nota')).toBe('nota.md');
  });

  it('keeps an extension that is already there', () => {
    expect(wikiTargetToFile('nota.md')).toBe('nota.md');
  });

  it('accepts a target inside a folder', () => {
    expect(wikiTargetToFile('carpeta/nota')).toBe('carpeta/nota.md');
  });

  it('normalises backslashes', () => {
    expect(wikiTargetToFile('carpeta\\nota')).toBe('carpeta/nota.md');
  });
});

describe('rendering wiki links', () => {
  it('renders a link to the target file', () => {
    const html = renderMarkdown('ver [[otra nota]] ahora');
    expect(html).toContain('href="otra nota.md"');
    expect(html).toContain('>otra nota</a>');
  });

  it('uses the label when there is one', () => {
    const html = renderMarkdown('[[destino|texto visible]]');
    expect(html).toContain('href="destino.md"');
    expect(html).toContain('>texto visible</a>');
  });

  it('marks the link with its own class', () => {
    expect(renderMarkdown('[[nota]]')).toContain('wiki-link');
  });

  it('leaves an unclosed bracket pair as text', () => {
    expect(renderMarkdown('[[sin cerrar')).toContain('[[sin cerrar');
  });

  it('does not touch a normal link', () => {
    const html = renderMarkdown('[normal](https://a.com)');
    expect(html).toContain('href="https://a.com"');
    expect(html).not.toContain('wiki-link');
  });
});

describe('wikiCandidates', () => {
  const names = ['reunion.md', 'recetas.md', 'proyecto reader.md', 'diario.md'];

  it('returns everything for an empty query', () => {
    expect(wikiCandidates(names, '')).toHaveLength(4);
  });

  it('puts a prefix match first', () => {
    expect(wikiCandidates(names, 're')[0]).toBe('recetas.md');
  });

  it('matches in the middle of the name', () => {
    expect(wikiCandidates(names, 'reader')).toEqual(['proyecto reader.md']);
  });

  it('ignores accents and case', () => {
    expect(wikiCandidates(['canción.md'], 'CANCION')).toEqual(['canción.md']);
  });

  it('returns nothing when nothing matches', () => {
    expect(wikiCandidates(names, 'zzz')).toEqual([]);
  });
});
