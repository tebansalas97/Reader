import { beforeEach, describe, expect, it } from 'vitest';
import { clearSelectionMark, markSelection, plainFragment } from './decorations';

function block(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.append(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('plainFragment', () => {
  it('drops bold markers', () => {
    expect(plainFragment('un **texto** claro')).toBe('un texto claro');
  });

  it('drops italic markers', () => {
    expect(plainFragment('un *texto* claro')).toBe('un texto claro');
  });

  it('drops inline code markers', () => {
    expect(plainFragment('usa `npm test` ya')).toBe('usa npm test ya');
  });

  it('keeps only the label of a link', () => {
    expect(plainFragment('ver [el sitio](https://a.com)')).toBe('ver el sitio');
  });

  it('drops a list marker', () => {
    expect(plainFragment('- un elemento')).toBe('un elemento');
  });

  it('drops a task marker', () => {
    expect(plainFragment('- [x] hecho')).toBe('hecho');
  });

  it('drops heading hashes', () => {
    expect(plainFragment('## Un titulo')).toBe('Un titulo');
  });

  it('drops a quote marker', () => {
    expect(plainFragment('> una cita')).toBe('una cita');
  });

  it('collapses whitespace', () => {
    expect(plainFragment('uno   \n  dos')).toBe('uno dos');
  });
});

describe('markSelection', () => {
  it('wraps the selected words in a mark', () => {
    const el = block('<p>uno dos tres</p>');
    expect(markSelection(el, 'dos tres')).toBe(true);
    expect(el.querySelector('mark')?.textContent).toBe('dos tres');
  });

  it('finds text that spans inline markup', () => {
    const el = block('<p>un <strong>texto</strong> claro</p>');
    expect(markSelection(el, 'un **texto** claro')).toBe(true);
    expect(el.querySelector('mark')).not.toBeNull();
  });

  it('matches across a line break in the source', () => {
    const el = block('<p>una frase larga partida</p>');
    expect(markSelection(el, 'frase\nlarga')).toBe(true);
    expect(el.querySelector('mark')?.textContent).toBe('frase larga');
  });

  it('ignores a fragment that is not present', () => {
    const el = block('<p>uno dos</p>');
    expect(markSelection(el, 'nada de esto')).toBe(false);
    expect(el.querySelector('mark')).toBeNull();
  });

  it('ignores a fragment shorter than two characters', () => {
    const el = block('<p>uno dos</p>');
    expect(markSelection(el, 'u')).toBe(false);
  });

  it('replaces the previous mark instead of stacking', () => {
    const el = block('<p>uno dos tres</p>');
    markSelection(el, 'uno');
    markSelection(el, 'tres');
    expect(el.querySelectorAll('mark')).toHaveLength(1);
    expect(el.querySelector('mark')?.textContent).toBe('tres');
  });

  it('leaves the text intact after clearing', () => {
    const el = block('<p>uno dos tres</p>');
    markSelection(el, 'dos');
    clearSelectionMark(el);
    expect(el.querySelectorAll('mark')).toHaveLength(0);
    expect(el.textContent).toBe('uno dos tres');
  });

  it('treats regular expression characters literally', () => {
    const el = block('<p>coste (aprox.) 5</p>');
    expect(markSelection(el, '(aprox.)')).toBe(true);
    expect(el.querySelector('mark')?.textContent).toBe('(aprox.)');
  });

  it('does not match text inside a button', () => {
    const el = block('<pre><code>valor</code><button>Copiar</button></pre>');
    expect(markSelection(el, 'Copiar')).toBe(false);
  });
});
