import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFS } from '$lib/state/prefs.svelte';
import { createEditor, reconfigureEditor, setEditorReadOnly } from './create';

function mount(doc = '') {
  const parent = document.createElement('div');
  document.body.append(parent);
  const onChange = vi.fn();
  const onCursor = vi.fn();
  const view = createEditor({
    parent,
    doc,
    prefs: DEFAULT_PREFS,
    theme: 'light',
    onChange,
    onCursor,
    onScrollLine: () => undefined,
  });
  return { view, onChange, onCursor };
}

describe('createEditor', () => {
  it('mounts with the given document', () => {
    const { view } = mount('# hola');
    expect(view.state.doc.toString()).toBe('# hola');
    view.destroy();
  });

  it('reports changes through onChange', () => {
    const { view, onChange } = mount('');
    view.dispatch({ changes: { from: 0, insert: 'a' } });
    expect(onChange).toHaveBeenCalledWith('a');
    view.destroy();
  });

  it('does not report a pure selection change as a document change', () => {
    const { view, onChange } = mount('abc');
    view.dispatch({ selection: { anchor: 1 } });
    expect(onChange).not.toHaveBeenCalled();
    view.destroy();
  });

  it('reports the cursor position as one-based line and column', () => {
    const { view, onCursor } = mount('uno\ndos');
    view.dispatch({ selection: { anchor: 5 } });
    expect(onCursor).toHaveBeenLastCalledWith(2, 2);
    view.destroy();
  });

  it('applies the configured tab size', () => {
    const { view } = mount('');
    expect(view.state.tabSize).toBe(DEFAULT_PREFS.tabSize);
    view.destroy();
  });

  it('reconfigures without losing the document or the cursor', () => {
    const { view } = mount('hola mundo');
    view.dispatch({ selection: { anchor: 4 } });
    reconfigureEditor(view, { ...DEFAULT_PREFS, editorFontSize: 20 }, 'dark');
    expect(view.state.doc.toString()).toBe('hola mundo');
    expect(view.state.selection.main.anchor).toBe(4);
    view.destroy();
  });

  it('blocks edits when set to read only', () => {
    const { view } = mount('fijo');
    setEditorReadOnly(view, true);
    expect(view.state.readOnly).toBe(true);
    view.destroy();
  });
});
