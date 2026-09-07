import { EditorView } from '@codemirror/view';
import { render } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReaderError } from '$lib/fs/api-types';

const files = new Map<string, string>();

vi.mock('$lib/fs/api', () => ({
  readText: vi.fn(async (path: string) => {
    if (!files.has(path)) throw new ReaderError('NotFound', 'no existe', path);
    return { text: files.get(path)!, modifiedMs: 1, lineEnding: 'lf' as const };
  }),
  writeText: vi.fn(async () => 2),
  watch: vi.fn(async () => undefined),
  unwatch: vi.fn(async () => undefined),
  pushRecent: vi.fn(async () => []),
  getPrefs: vi.fn(async () => ({})),
  setPrefs: vi.fn(async () => undefined),
}));

const { documents } = await import('$lib/state/documents.svelte');
const Editor = (await import('./Editor.svelte')).default;

const DOC = 'primera linea\nsegunda linea\ntercera linea';

function editorView(container: HTMLElement): EditorView | null {
  const dom = container.querySelector('.cm-editor');
  return dom ? EditorView.findFromDOM(dom as HTMLElement) : null;
}

beforeEach(async () => {
  files.clear();
  documents.reset();
  files.set('C:/d/a.md', DOC);
  await documents.open('C:/d/a.md');
});

describe('Editor', () => {
  it('mounts with the document text', () => {
    const id = documents.activeId!;
    const { container } = render(Editor, { docId: id });
    expect(editorView(container)?.state.doc.toString()).toBe(DOC);
  });

  it('keeps the same editor instance when the document text changes', async () => {
    const id = documents.activeId!;
    const { container } = render(Editor, { docId: id });
    const before = editorView(container);
    expect(before).not.toBeNull();
    before?.dispatch({ changes: { from: 0, insert: 'X' } });
    await Promise.resolve();
    expect(editorView(container)).toBe(before);
  });

  it('leaves the cursor where the user typed instead of jumping to line one', async () => {
    const id = documents.activeId!;
    const { container } = render(Editor, { docId: id });
    const view = editorView(container)!;
    const position = DOC.indexOf('segunda') + 3;
    view.dispatch({ selection: { anchor: position } });
    view.dispatch(view.state.replaceSelection('ZZ'));
    await Promise.resolve();
    expect(view.state.selection.main.head).toBe(position + 2);
    expect(view.state.doc.lineAt(view.state.selection.main.head).number).toBe(2);
  });

  it('keeps a selection alive across an edit somewhere else', async () => {
    const id = documents.activeId!;
    const { container } = render(Editor, { docId: id });
    const view = editorView(container)!;
    view.dispatch({ selection: { anchor: 0, head: 7 } });
    await Promise.resolve();
    expect(view.state.selection.main.empty).toBe(false);
    expect(view.state.sliceDoc(0, 7)).toBe('primera');
  });

  it('pushes the typed text into the document store', async () => {
    const id = documents.activeId!;
    const { container } = render(Editor, { docId: id });
    editorView(container)?.dispatch({ changes: { from: 0, insert: 'X' } });
    await Promise.resolve();
    expect(documents.markdownById(id)?.text.startsWith('X')).toBe(true);
  });

  it('adopts an external text change without losing the editor', async () => {
    const id = documents.activeId!;
    const { container } = render(Editor, { docId: id });
    const before = editorView(container);
    documents.setText(id, 'contenido externo');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(editorView(container)).toBe(before);
    expect(editorView(container)?.state.doc.toString()).toBe('contenido externo');
  });
});

describe('Editor mouse selection', () => {
  function mousedown(view: EditorView, detail: number): MouseEvent {
    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      detail,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    view.contentDOM.dispatchEvent(event);
    return event;
  }

  it('selects the word under a double click', () => {
    const id = documents.activeId!;
    const { container } = render(Editor, { docId: id });
    const view = editorView(container)!;
    const position = DOC.indexOf('segunda') + 2;
    view.posAtCoords = () => position;
    const event = mousedown(view, 2);
    expect(event.defaultPrevented).toBe(true);
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
      'segunda',
    );
  });

  it('selects the sentence under a triple click', () => {
    const id = documents.activeId!;
    documents.setText(id, 'Una frase. Otra frase mas larga.');
    const { container } = render(Editor, { docId: id });
    const view = editorView(container)!;
    view.posAtCoords = () => 15;
    mousedown(view, 3);
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
      'Otra frase mas larga.',
    );
  });

  it('never includes the line break in a triple click', () => {
    const id = documents.activeId!;
    const { container } = render(Editor, { docId: id });
    const view = editorView(container)!;
    view.posAtCoords = () => 3;
    mousedown(view, 3);
    const selected = view.state.sliceDoc(
      view.state.selection.main.from,
      view.state.selection.main.to,
    );
    expect(selected).toBe('primera linea');
    expect(selected).not.toContain('\n');
  });

  it('does not select a word on a single click', () => {
    const id = documents.activeId!;
    const { container } = render(Editor, { docId: id });
    const view = editorView(container)!;
    view.posAtCoords = () => 5;
    mousedown(view, 1);
    expect(view.state.selection.main.empty).toBe(true);
  });

  it('reports the selected fragment to the parent', async () => {
    const id = documents.activeId!;
    const onfragment = vi.fn();
    const { container } = render(Editor, { docId: id, onfragment });
    const view = editorView(container)!;
    view.dispatch({ selection: { anchor: 0, head: 7 } });
    await Promise.resolve();
    expect(onfragment).toHaveBeenLastCalledWith('primera');
  });
});

describe('Editor task toggling', () => {
  it('checks the task on the requested line', async () => {
    const id = documents.activeId!;
    documents.setText(id, '- [ ] uno\n- [x] dos');
    const { component, container } = render(Editor, { docId: id });
    await new Promise((resolve) => setTimeout(resolve, 0));
    (component as unknown as { toggleTask: (line: number) => void }).toggleTask(0);
    expect(editorView(container)?.state.doc.toString()).toBe('- [x] uno\n- [x] dos');
  });

  it('unchecks a checked task', async () => {
    const id = documents.activeId!;
    documents.setText(id, '- [ ] uno\n- [x] dos');
    const { component, container } = render(Editor, { docId: id });
    await new Promise((resolve) => setTimeout(resolve, 0));
    (component as unknown as { toggleTask: (line: number) => void }).toggleTask(1);
    expect(editorView(container)?.state.doc.toString()).toBe('- [ ] uno\n- [ ] dos');
  });

  it('leaves a line that is not a task alone', async () => {
    const id = documents.activeId!;
    documents.setText(id, '- normal\n- [x] dos');
    const { component, container } = render(Editor, { docId: id });
    await new Promise((resolve) => setTimeout(resolve, 0));
    (component as unknown as { toggleTask: (line: number) => void }).toggleTask(0);
    expect(editorView(container)?.state.doc.toString()).toBe('- normal\n- [x] dos');
  });
});
