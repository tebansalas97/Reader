import { describe, expect, it } from 'vitest';
import { buildStandaloneHtml } from './html';

const base = {
  title: 'Mi nota',
  bodyHtml: '<h1>Hola</h1>',
  css: 'body{color:red}',
  theme: 'light' as const,
};

describe('buildStandaloneHtml', () => {
  it('produces a complete document', () => {
    const html = buildStandaloneHtml(base);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('</html>');
  });

  it('uses the document title', () => {
    expect(buildStandaloneHtml(base)).toContain('<title>Mi nota</title>');
  });

  it('escapes the title', () => {
    const html = buildStandaloneHtml({ ...base, title: '<script>x</script>' });
    expect(html).not.toContain('<title><script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('inlines the stylesheet', () => {
    expect(buildStandaloneHtml(base)).toContain('body{color:red}');
  });

  it('includes the rendered body', () => {
    expect(buildStandaloneHtml(base)).toContain('<h1>Hola</h1>');
  });

  it('carries no script tags', () => {
    expect(buildStandaloneHtml(base)).not.toContain('<script');
  });

  it('sets the theme attribute on the root element', () => {
    expect(buildStandaloneHtml({ ...base, theme: 'dark' })).toContain('data-theme="dark"');
  });

  it('declares utf-8', () => {
    expect(buildStandaloneHtml(base)).toContain('charset="utf-8"');
  });
});
