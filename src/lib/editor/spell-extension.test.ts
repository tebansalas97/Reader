import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureSpelling, resetSpelling } from './spell';
import { misspelledAt, refreshSpelling, spellExtension } from './spell-extension';

const root = join(process.cwd(), 'public', 'dictionaries');

function mount(doc: string): EditorView {
  const parent = document.createElement('div');
  document.body.append(parent);
  const state = EditorState.create({ doc, extensions: [spellExtension()] });
  return new EditorView({ state, parent });
}

function marked(view: EditorView): string[] {
  return Array.from(view.dom.querySelectorAll('.cm-misspelled')).map(
    (el) => el.textContent ?? '',
  );
}

beforeEach(async () => {
  resetSpelling();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = url.split('/').pop() ?? '';
      const body = await readFile(join(root, name), 'utf8');
      return { ok: true, status: 200, text: async () => body } as unknown as Response;
    }),
  );
  await ensureSpelling('es');
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetSpelling();
});

describe('spell extension', () => {
  it('marks nothing while it is disabled', () => {
    const view = mount('una palabraa mal escritaa');
    expect(marked(view)).toEqual([]);
    view.destroy();
  });

  it('marks the misspelled words once enabled', () => {
    const view = mount('una palabraa mal escritaa');
    refreshSpelling(view, { enabled: true, language: 'es' });
    expect(marked(view)).toEqual(['palabraa', 'escritaa']);
    view.destroy();
  });

  it('leaves correct words alone', () => {
    const view = mount('una palabra bien escrita');
    refreshSpelling(view, { enabled: true, language: 'es' });
    expect(marked(view)).toEqual([]);
    view.destroy();
  });

  it('stops marking when it is turned off again', () => {
    const view = mount('una palabraa');
    refreshSpelling(view, { enabled: true, language: 'es' });
    expect(marked(view)).toHaveLength(1);
    refreshSpelling(view, { enabled: false, language: 'es' });
    expect(marked(view)).toEqual([]);
    view.destroy();
  });

  it('updates the marks when the text changes', () => {
    const view = mount('una palabra');
    refreshSpelling(view, { enabled: true, language: 'es' });
    expect(marked(view)).toEqual([]);
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'una palabraa' } });
    expect(marked(view)).toEqual(['palabraa']);
    view.destroy();
  });

  it('does not mark inside a code block', () => {
    const view = mount('```\nlorm ipsm\n```');
    refreshSpelling(view, { enabled: true, language: 'es' });
    expect(marked(view)).toEqual([]);
    view.destroy();
  });
});

describe('misspelledAt', () => {
  it('finds the word under a position', () => {
    const view = mount('una palabraa mal');
    refreshSpelling(view, { enabled: true, language: 'es' });
    expect(misspelledAt(view, 6)?.word).toBe('palabraa');
    view.destroy();
  });

  it('returns null over a correct word', () => {
    const view = mount('una palabra mal');
    refreshSpelling(view, { enabled: true, language: 'es' });
    expect(misspelledAt(view, 1)).toBeNull();
    view.destroy();
  });

  it('returns null while spelling is off', () => {
    const view = mount('una palabraa mal');
    expect(misspelledAt(view, 6)).toBeNull();
    view.destroy();
  });
});
