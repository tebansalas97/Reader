import { beforeEach, describe, expect, it } from 'vitest';
import { patchPreview } from './patch';

function root(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('patchPreview', () => {
  it('fills an empty root', () => {
    const el = root();
    patchPreview(el, '<p data-line="0">hola</p>');
    expect(el.querySelector('p')?.textContent).toBe('hola');
  });

  it('keeps the identity of a node whose content did not change', () => {
    const el = root();
    patchPreview(el, '<p data-line="0">uno</p><p data-line="2">dos</p>');
    const first = el.querySelector('p');
    patchPreview(el, '<p data-line="0">uno</p><p data-line="2">DOS</p>');
    expect(el.querySelector('p')).toBe(first);
  });

  it('updates only the changed node text', () => {
    const el = root();
    patchPreview(el, '<p data-line="0">uno</p><p data-line="2">dos</p>');
    patchPreview(el, '<p data-line="0">uno</p><p data-line="2">DOS</p>');
    expect(el.querySelectorAll('p')[1]?.textContent).toBe('DOS');
  });

  it('removes nodes that disappeared', () => {
    const el = root();
    patchPreview(el, '<p data-line="0">uno</p><p data-line="2">dos</p>');
    patchPreview(el, '<p data-line="0">uno</p>');
    expect(el.querySelectorAll('p').length).toBe(1);
  });

  it('appends nodes that were added', () => {
    const el = root();
    patchPreview(el, '<p data-line="0">uno</p>');
    patchPreview(el, '<p data-line="0">uno</p><p data-line="2">dos</p>');
    expect(el.querySelectorAll('p').length).toBe(2);
  });

  it('clears the root for empty html', () => {
    const el = root();
    patchPreview(el, '<p data-line="0">uno</p>');
    patchPreview(el, '');
    expect(el.innerHTML).toBe('');
  });

  it('preserves a rendered mermaid block instead of re-patching it', () => {
    const el = root();
    patchPreview(el, '<pre data-line="0" class="mermaid" data-rendered="1"><svg></svg></pre>');
    const pre = el.querySelector('pre');
    patchPreview(el, '<pre data-line="0" class="mermaid">graph TD</pre>');
    expect(el.querySelector('pre')).toBe(pre);
    expect(el.querySelector('svg')).not.toBeNull();
  });
});
