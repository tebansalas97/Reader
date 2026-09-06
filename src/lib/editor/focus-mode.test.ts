import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import { applyFocusMode, focusExtension } from './focus-mode';

const DOC = '# Titulo\n\nPrimer parrafo\nque sigue aqui\n\nSegundo parrafo\n\nTercero';

function mount(doc = DOC): EditorView {
  const parent = document.createElement('div');
  document.body.append(parent);
  const state = EditorState.create({ doc, extensions: [focusExtension()] });
  return new EditorView({ state, parent });
}

function dimmedLines(view: EditorView): string[] {
  return Array.from(view.dom.querySelectorAll('.cm-dimmed-line')).map(
    (el) => el.textContent ?? '',
  );
}

describe('focus mode', () => {
  it('dims nothing while it is off', () => {
    const view = mount();
    expect(dimmedLines(view)).toEqual([]);
    view.destroy();
  });

  it('dims every line outside the active block', () => {
    const view = mount();
    view.dispatch({ selection: { anchor: DOC.indexOf('Primer') } });
    applyFocusMode(view, true);
    const dim = dimmedLines(view);
    expect(dim).not.toContain('Primer parrafo');
    expect(dim).not.toContain('que sigue aqui');
    expect(dim).toContain('# Titulo');
    expect(dim).toContain('Segundo parrafo');
  });

  it('follows the cursor to another block', () => {
    const view = mount();
    applyFocusMode(view, true);
    view.dispatch({ selection: { anchor: DOC.indexOf('Segundo') } });
    const dim = dimmedLines(view);
    expect(dim).not.toContain('Segundo parrafo');
    expect(dim).toContain('Primer parrafo');
    view.destroy();
  });

  it('keeps a heading undimmed when the cursor is on it', () => {
    const view = mount();
    view.dispatch({ selection: { anchor: 2 } });
    applyFocusMode(view, true);
    expect(dimmedLines(view)).not.toContain('# Titulo');
    view.destroy();
  });

  it('stops dimming when it is turned off', () => {
    const view = mount();
    applyFocusMode(view, true);
    expect(dimmedLines(view).length).toBeGreaterThan(0);
    applyFocusMode(view, false);
    expect(dimmedLines(view)).toEqual([]);
    view.destroy();
  });

  it('dims nothing in a document with a single block', () => {
    const view = mount('una sola linea');
    applyFocusMode(view, true);
    expect(dimmedLines(view)).toEqual([]);
    view.destroy();
  });
});
