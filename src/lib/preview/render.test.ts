import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './render';

describe('renderMarkdown', () => {
  it('renders a heading', () => {
    expect(renderMarkdown('# Hola')).toContain('Hola</h1>');
  });

  it('marks top-level blocks with their start line', () => {
    const html = renderMarkdown('# Uno\n\nDos\n');
    expect(html).toMatch(/<h1[^>]*data-line="0"/);
    expect(html).toMatch(/<p[^>]*data-line="2"/);
  });

  it('gives headings an id for the outline', () => {
    expect(renderMarkdown('# Mi título')).toMatch(/id="[^"]+"/);
  });

  it('renders GitHub tables', () => {
    const html = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |');
    expect(html).toContain('<table');
    expect(html).toContain('<td>1</td>');
  });

  it('renders task list checkboxes that the reader can toggle', () => {
    const html = renderMarkdown('- [x] hecho\n- [ ] pendiente');
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('disabled');
  });

  it('keeps the checked state of a finished task', () => {
    expect(renderMarkdown('- [x] hecho')).toContain('checked');
  });

  it('gives each list item its source line', () => {
    const html = renderMarkdown('- uno\n- dos');
    expect(html).toMatch(/<li[^>]*data-line="0"/);
    expect(html).toMatch(/<li[^>]*data-line="1"/);
  });

  it('strips any input that is not a checkbox', () => {
    const html = renderMarkdown('<input type="text" name="robo">');
    expect(html).not.toContain('<input');
  });

  it('renders footnotes', () => {
    const html = renderMarkdown('Texto[^1]\n\n[^1]: Nota');
    expect(html).toContain('footnote');
  });

  it('linkifies bare urls', () => {
    expect(renderMarkdown('ver https://example.com')).toContain('href="https://example.com"');
  });

  it('keeps straight quotes because typographer is off', () => {
    expect(renderMarkdown('"comillas"')).toContain('"comillas"');
  });

  it('strips script tags from raw html', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\ntexto');
    expect(html).not.toContain('<script');
  });

  it('strips inline event handlers', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain('onerror');
  });

  it('never emits a link whose href is a javascript url', () => {
    const html = renderMarkdown('[x](javascript:alert(1))');
    expect(html).not.toMatch(/href="javascript:/i);
  });

  it('keeps a fenced code block with its language class', () => {
    const html = renderMarkdown('```js\nconst a = 1;\n```');
    expect(html).toContain('language-js');
  });

  it('escapes html inside a code block', () => {
    const html = renderMarkdown('```\n<b>x</b>\n```');
    expect(html).toContain('&lt;b&gt;');
  });

  it('leaves math delimiters untouched for the lazy katex pass', () => {
    expect(renderMarkdown('$E = mc^2$')).toContain('$E = mc^2$');
  });

  it('returns an empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });
});
