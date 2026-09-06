import { describe, expect, it } from 'vitest';
import { htmlToMarkdown, looksLikeRichHtml } from './html-to-markdown';

describe('htmlToMarkdown', () => {
  it('converts headings', () => {
    expect(htmlToMarkdown('<h2>Título</h2>')).toBe('## Título');
  });

  it('converts a paragraph with bold and italic', () => {
    expect(htmlToMarkdown('<p>uno <strong>dos</strong> <em>tres</em></p>')).toBe(
      'uno **dos** *tres*',
    );
  });

  it('converts links', () => {
    expect(htmlToMarkdown('<p><a href="https://a.com">sitio</a></p>')).toBe(
      '[sitio](https://a.com)',
    );
  });

  it('converts images', () => {
    expect(htmlToMarkdown('<p><img src="a.png" alt="foto"></p>')).toBe('![foto](a.png)');
  });

  it('converts inline code', () => {
    expect(htmlToMarkdown('<p>usa <code>npm test</code></p>')).toBe('usa `npm test`');
  });

  it('converts an unordered list', () => {
    expect(htmlToMarkdown('<ul><li>uno</li><li>dos</li></ul>')).toBe('- uno\n- dos');
  });

  it('converts an ordered list with its numbering', () => {
    expect(htmlToMarkdown('<ol><li>uno</li><li>dos</li></ol>')).toBe('1. uno\n2. dos');
  });

  it('indents a nested list', () => {
    const html = '<ul><li>uno<ul><li>anidado</li></ul></li></ul>';
    expect(htmlToMarkdown(html)).toBe('- uno\n  - anidado');
  });

  it('converts a table with its header', () => {
    const html = '<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>';
    expect(htmlToMarkdown(html)).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |');
  });

  it('escapes pipes inside table cells', () => {
    const html = '<table><tr><th>a|b</th></tr><tr><td>c</td></tr></table>';
    expect(htmlToMarkdown(html)).toContain('a\\|b');
  });

  it('converts a code block keeping its language', () => {
    const html = '<pre><code class="language-js">const a = 1;</code></pre>';
    expect(htmlToMarkdown(html)).toBe('```js\nconst a = 1;\n```');
  });

  it('converts a blockquote', () => {
    expect(htmlToMarkdown('<blockquote><p>cita</p></blockquote>')).toBe('> cita');
  });

  it('converts a horizontal rule', () => {
    expect(htmlToMarkdown('<hr>')).toBe('---');
  });

  it('drops script and style content', () => {
    expect(htmlToMarkdown('<p>ok</p><script>alert(1)</script><style>p{}</style>')).toBe('ok');
  });

  it('separates blocks with a blank line', () => {
    expect(htmlToMarkdown('<p>uno</p><p>dos</p>')).toBe('uno\n\ndos');
  });

  it('collapses runs of whitespace', () => {
    expect(htmlToMarkdown('<p>uno    \n   dos</p>')).toBe('uno dos');
  });

  it('returns an empty string for empty input', () => {
    expect(htmlToMarkdown('')).toBe('');
  });

  it('unwraps nested divs without losing structure', () => {
    expect(htmlToMarkdown('<div><div><h1>T</h1><p>cuerpo</p></div></div>')).toBe('# T\n\ncuerpo');
  });
});

describe('looksLikeRichHtml', () => {
  it('detects formatted html', () => {
    expect(looksLikeRichHtml('<p>hola</p>')).toBe(true);
  });

  it('ignores a bare text fragment', () => {
    expect(looksLikeRichHtml('solo texto')).toBe(false);
  });

  it('ignores markup with no meaningful tags', () => {
    expect(looksLikeRichHtml('<span>x</span>')).toBe(false);
  });
});
