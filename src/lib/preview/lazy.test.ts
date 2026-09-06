import { beforeEach, describe, expect, it } from 'vitest';
import { needsHighlight, needsMath, needsMermaid } from './lazy';

function root(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('needsHighlight', () => {
  it('is true for a code block with a language class', () => {
    expect(needsHighlight(root('<pre><code class="language-js">a</code></pre>'))).toBe(true);
  });

  it('is false for a code block without a language', () => {
    expect(needsHighlight(root('<pre><code>a</code></pre>'))).toBe(false);
  });

  it('is false once the block is marked as highlighted', () => {
    expect(
      needsHighlight(root('<pre><code class="language-js" data-rendered="1">a</code></pre>')),
    ).toBe(false);
  });

  it('is false for mermaid blocks', () => {
    expect(needsHighlight(root('<pre><code class="language-mermaid">graph TD</code></pre>'))).toBe(
      false,
    );
  });

  it('resolves an alias to its real language', () => {
    expect(needsHighlight(root('<pre><code class="language-ts">a</code></pre>'))).toBe(true);
  });
});

describe('needsMath', () => {
  it('is true for inline math', () => {
    expect(needsMath('sea $x$ un número')).toBe(true);
  });

  it('is true for display math', () => {
    expect(needsMath('$$\\int f$$')).toBe(true);
  });

  it('is false for a lone dollar sign', () => {
    expect(needsMath('cuesta 5$ solamente')).toBe(false);
  });

  it('is false for a dollar inside a fenced block', () => {
    expect(needsMath('```\nconst a = "$x$";\n```')).toBe(false);
  });

  it('is false for an empty document', () => {
    expect(needsMath('')).toBe(false);
  });
});

describe('needsMermaid', () => {
  it('is true for an unrendered mermaid block', () => {
    expect(needsMermaid(root('<pre><code class="language-mermaid">graph TD</code></pre>'))).toBe(
      true,
    );
  });

  it('is false once rendered', () => {
    expect(needsMermaid(root('<pre class="mermaid" data-rendered="1"><svg></svg></pre>'))).toBe(
      false,
    );
  });

  it('is false for a plain code block', () => {
    expect(needsMermaid(root('<pre><code class="language-js">a</code></pre>'))).toBe(false);
  });
});
