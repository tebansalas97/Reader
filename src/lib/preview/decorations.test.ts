import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearHighlight,
  codeTextOf,
  decorateCodeBlocks,
  decorateDiagrams,
  diagramSvgOf,
  highlightBlock,
  lineOfBlock,
} from './decorations';

function root(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.append(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('decorateCodeBlocks', () => {
  it('adds a copy button to a code block', () => {
    const el = root('<pre><code>a</code></pre>');
    decorateCodeBlocks(el, 'Copiar');
    expect(el.querySelector('button.code-copy')?.textContent).toBe('Copiar');
  });

  it('does not add a second button on a repeated pass', () => {
    const el = root('<pre><code>a</code></pre>');
    decorateCodeBlocks(el, 'Copiar');
    decorateCodeBlocks(el, 'Copiar');
    expect(el.querySelectorAll('button.code-copy')).toHaveLength(1);
  });

  it('skips rendered diagrams', () => {
    const el = root('<pre class="mermaid"><svg></svg></pre>');
    decorateCodeBlocks(el, 'Copiar');
    expect(el.querySelector('button.code-copy')).toBeNull();
  });

  it('skips diagrams that failed to render', () => {
    const el = root('<pre class="mermaid-error">bad</pre>');
    decorateCodeBlocks(el, 'Copiar');
    expect(el.querySelector('button.code-copy')).toBeNull();
  });
});

describe('decorateDiagrams', () => {
  it('adds a zoom button to a rendered diagram', () => {
    const el = root('<pre class="mermaid"><svg></svg></pre>');
    decorateDiagrams(el, 'Ampliar');
    expect(el.querySelector('button.diagram-zoom')).not.toBeNull();
  });

  it('leaves plain code blocks alone', () => {
    const el = root('<pre><code>a</code></pre>');
    decorateDiagrams(el, 'Ampliar');
    expect(el.querySelector('button.diagram-zoom')).toBeNull();
  });

  it('is idempotent', () => {
    const el = root('<pre class="mermaid"><svg></svg></pre>');
    decorateDiagrams(el, 'Ampliar');
    decorateDiagrams(el, 'Ampliar');
    expect(el.querySelectorAll('button.diagram-zoom')).toHaveLength(1);
  });
});

describe('rendered diagram markers', () => {
  it('marks a rendered diagram so a click can find it', () => {
    const el = root('<pre class="mermaid" data-rendered="1"><svg></svg></pre>');
    expect(el.querySelector('pre.mermaid[data-rendered]')).not.toBeNull();
  });

  it('does not mark a diagram that failed to render', () => {
    const el = root('<pre class="mermaid-error" data-rendered="1">bad</pre>');
    expect(el.querySelector('pre.mermaid[data-rendered]')).toBeNull();
  });
});

describe('codeTextOf', () => {
  it('returns the code text', () => {
    const el = root('<pre><code>const a = 1;</code></pre>');
    expect(codeTextOf(el.querySelector('pre')!)).toBe('const a = 1;');
  });

  it('excludes the copy button text', () => {
    const el = root('<pre><code>a</code></pre>');
    decorateCodeBlocks(el, 'Copiar');
    expect(codeTextOf(el.querySelector('pre')!)).toBe('a');
  });

  it('trims trailing newlines', () => {
    const el = root('<pre><code>a\n\n</code></pre>');
    expect(codeTextOf(el.querySelector('pre')!)).toBe('a');
  });
});

describe('diagramSvgOf', () => {
  it('returns the svg markup', () => {
    const el = root('<pre class="mermaid"><svg><g></g></svg></pre>');
    expect(diagramSvgOf(el.querySelector('pre')!)).toContain('<g>');
  });

  it('adds the svg namespace when missing', () => {
    const el = root('<pre class="mermaid"><svg></svg></pre>');
    expect(diagramSvgOf(el.querySelector('pre')!)).toContain('http://www.w3.org/2000/svg');
  });

  it('returns null when there is no diagram', () => {
    const el = root('<pre><code>a</code></pre>');
    expect(diagramSvgOf(el.querySelector('pre')!)).toBeNull();
  });
});

describe('highlightBlock', () => {
  const html = '<h1 data-line="0">a</h1><p data-line="2">b</p><p data-line="6">c</p>';

  it('marks the block that contains the line', () => {
    const el = root(html);
    highlightBlock(el, 2, 3);
    expect(el.querySelector('.is-active-block')?.textContent).toBe('b');
  });

  it('marks only one block at a time', () => {
    const el = root(html);
    highlightBlock(el, 2, 3);
    highlightBlock(el, 6, 6);
    expect(el.querySelectorAll('.is-active-block')).toHaveLength(1);
    expect(el.querySelector('.is-active-block')?.textContent).toBe('c');
  });

  it('falls back to the nearest earlier block', () => {
    const el = root(html);
    highlightBlock(el, 4, 4);
    expect(el.querySelector('.is-active-block')?.textContent).toBe('b');
  });

  it('does nothing on an empty preview', () => {
    const el = root('');
    expect(() => highlightBlock(el, 0, 0)).not.toThrow();
  });
});

describe('clearHighlight', () => {
  it('removes every highlight', () => {
    const el = root('<p data-line="0" class="is-active-block">a</p>');
    clearHighlight(el);
    expect(el.querySelectorAll('.is-active-block')).toHaveLength(0);
  });
});

describe('lineOfBlock', () => {
  it('reads the line of the closest block', () => {
    const el = root('<p data-line="4"><em>x</em></p>');
    expect(lineOfBlock(el.querySelector('em')!)).toBe(4);
  });

  it('returns null outside any block', () => {
    const el = root('<span>x</span>');
    expect(lineOfBlock(el.querySelector('span')!)).toBeNull();
  });
});
