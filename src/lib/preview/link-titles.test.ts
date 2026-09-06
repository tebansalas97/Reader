import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => `http://asset.localhost/${encodeURIComponent(p)}`,
}));

vi.mock('$lib/fs/api', () => ({ openExternal: vi.fn(async () => undefined) }));

const { annotateLinks, describeLink } = await import('./links');

const LABELS = {
  external: 'Abrir en el navegador',
  document: 'Abrir',
  section: 'Ir a',
  unknownSection: 'Sección no encontrada',
};

function root(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.append(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('describeLink', () => {
  const noHeadings = () => null;

  it('describes an external link with its url', () => {
    expect(describeLink('https://a.com/x', 'C:/d/a.md', LABELS, noHeadings)).toBe(
      'Abrir en el navegador: https://a.com/x',
    );
  });

  it('describes a mail link', () => {
    expect(describeLink('mailto:a@b.com', null, LABELS, noHeadings)).toContain(
      'Abrir en el navegador',
    );
  });

  it('resolves a relative document link to its full path', () => {
    expect(describeLink('otra.md', 'C:/d/a.md', LABELS, noHeadings)).toBe('Abrir: C:/d/otra.md');
  });

  it('resolves a link that climbs a folder', () => {
    expect(describeLink('../otra.md', 'C:/d/sub/a.md', LABELS, noHeadings)).toBe(
      'Abrir: C:/d/otra.md',
    );
  });

  it('leaves a relative link alone when the document has no path', () => {
    expect(describeLink('otra.md', null, LABELS, noHeadings)).toBe('Abrir: otra.md');
  });

  it('names the section an anchor points at', () => {
    expect(describeLink('#uno', 'C:/d/a.md', LABELS, () => 'Sección uno')).toBe(
      'Ir a: Sección uno',
    );
  });

  it('reports an anchor with no matching heading', () => {
    expect(describeLink('#falta', 'C:/d/a.md', LABELS, noHeadings)).toBe('Sección no encontrada');
  });

  it('decodes a percent-encoded anchor', () => {
    const seen: string[] = [];
    describeLink('#secci%C3%B3n', null, LABELS, (id) => {
      seen.push(id);
      return null;
    });
    expect(seen).toEqual(['sección']);
  });

  it('returns null for an empty href', () => {
    expect(describeLink('', null, LABELS, noHeadings)).toBeNull();
  });
});

describe('annotateLinks', () => {
  it('adds a title to a document link', () => {
    const el = root('<a href="otra.md">x</a>');
    annotateLinks(el, 'C:/d/a.md', LABELS);
    expect(el.querySelector('a')?.getAttribute('title')).toBe('Abrir: C:/d/otra.md');
  });

  it('adds a title to a wiki link', () => {
    const el = root('<a class="wiki-link" href="nota.md">nota</a>');
    annotateLinks(el, 'C:/d/a.md', LABELS);
    expect(el.querySelector('a')?.getAttribute('title')).toBe('Abrir: C:/d/nota.md');
  });

  it('names the real heading behind an anchor', () => {
    const el = root('<h2 id="uno">Sección uno</h2><a href="#uno">ir</a>');
    annotateLinks(el, 'C:/d/a.md', LABELS);
    expect(el.querySelector('a')?.getAttribute('title')).toBe('Ir a: Sección uno');
  });

  it('adds a title to an external link', () => {
    const el = root('<a href="https://a.com">x</a>');
    annotateLinks(el, null, LABELS);
    expect(el.querySelector('a')?.getAttribute('title')).toContain('https://a.com');
  });

  it('removes a stale title from a link with no target', () => {
    const el = root('<a href="" title="viejo">x</a>');
    annotateLinks(el, null, LABELS);
    expect(el.querySelector('a')?.hasAttribute('title')).toBe(false);
  });

  it('is safe to run twice', () => {
    const el = root('<a href="otra.md">x</a>');
    annotateLinks(el, 'C:/d/a.md', LABELS);
    annotateLinks(el, 'C:/d/a.md', LABELS);
    expect(el.querySelector('a')?.getAttribute('title')).toBe('Abrir: C:/d/otra.md');
  });

  it('leaves a document with no links alone', () => {
    const el = root('<p>solo texto</p>');
    expect(() => annotateLinks(el, null, LABELS)).not.toThrow();
  });
});
