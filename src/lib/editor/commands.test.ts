import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import {
  blockRangeAt,
  buildTable,
  continueList,
  headingLine,
  insertCodeBlock,
  insertHorizontalRule,
  insertImage,
  insertLink,
  insertTable,
  selectedWordCount,
  linePrefixToggle,
  listContinuation,
  toggleHeading,
  toggleWrap,
  wrapSelection,
} from './commands';

function view(doc: string, anchor: number, head = anchor): EditorView {
  const state = EditorState.create({ doc, selection: EditorSelection.single(anchor, head) });
  return new EditorView({ state });
}

describe('wrapSelection', () => {
  it('wraps the selected range', () => {
    expect(wrapSelection('hola mundo', 0, 4, '**')).toEqual({
      text: '**hola**',
      from: 0,
      to: 4,
      unwrapped: false,
    });
  });

  it('unwraps when the markers sit outside the range', () => {
    expect(wrapSelection('**hola** mundo', 2, 6, '**').unwrapped).toBe(true);
  });

  it('unwraps when the markers are inside the range', () => {
    expect(wrapSelection('**hola** mundo', 0, 8, '**').text).toBe('hola');
  });
});

describe('toggleWrap', () => {
  it('makes the selection bold', () => {
    const v = view('hola mundo', 0, 4);
    toggleWrap(v, '**');
    expect(v.state.doc.toString()).toBe('**hola** mundo');
  });

  it('removes bold when applied twice', () => {
    const v = view('hola mundo', 0, 4);
    toggleWrap(v, '**');
    toggleWrap(v, '**');
    expect(v.state.doc.toString()).toBe('hola mundo');
  });

  it('inserts an empty marker and places the cursor inside when nothing is selected', () => {
    const v = view('', 0);
    toggleWrap(v, '**');
    expect(v.state.doc.toString()).toBe('****');
    expect(v.state.selection.main.head).toBe(2);
  });

  it('leaves the selection covering the same text after wrapping', () => {
    const v = view('hola', 0, 4);
    toggleWrap(v, '*');
    expect(v.state.sliceDoc(v.state.selection.main.from, v.state.selection.main.to)).toBe('hola');
  });
});

describe('headingLine', () => {
  it('adds hashes to a plain line', () => {
    expect(headingLine('texto', 2)).toBe('## texto');
  });

  it('replaces an existing heading level', () => {
    expect(headingLine('### texto', 1)).toBe('# texto');
  });

  it('removes the heading when the level matches', () => {
    expect(headingLine('## texto', 2)).toBe('texto');
  });
});

describe('toggleHeading', () => {
  it('turns the current line into a heading', () => {
    const v = view('texto', 2);
    toggleHeading(v, 1);
    expect(v.state.doc.toString()).toBe('# texto');
  });

  it('applies to every line touched by the selection', () => {
    const v = view('uno\ndos', 0, 7);
    toggleHeading(v, 2);
    expect(v.state.doc.toString()).toBe('## uno\n## dos');
  });
});

describe('linePrefixToggle', () => {
  it('adds a bullet', () => {
    expect(linePrefixToggle('texto', '- ')).toBe('- texto');
  });

  it('removes an existing bullet', () => {
    expect(linePrefixToggle('- texto', '- ')).toBe('texto');
  });

  it('keeps the leading indentation', () => {
    expect(linePrefixToggle('  texto', '> ')).toBe('  > texto');
  });
});

describe('insertLink', () => {
  it('wraps the selection as a link label', () => {
    const v = view('Anthropic', 0, 9);
    insertLink(v);
    expect(v.state.doc.toString()).toBe('[Anthropic]()');
  });

  it('fills the url when one is supplied', () => {
    const v = view('sitio', 0, 5);
    insertLink(v, 'https://a.com');
    expect(v.state.doc.toString()).toBe('[sitio](https://a.com)');
  });

  it('places the cursor in the label when nothing is selected', () => {
    const v = view('', 0);
    insertLink(v);
    expect(v.state.doc.toString()).toBe('[]()');
    expect(v.state.selection.main.head).toBe(1);
  });
});

describe('listContinuation', () => {
  it('continues a bullet list', () => {
    expect(listContinuation('- uno')).toBe('- ');
  });

  it('continues a task list unchecked', () => {
    expect(listContinuation('- [x] hecho')).toBe('- [ ] ');
  });

  it('increments an ordered list', () => {
    expect(listContinuation('3. tres')).toBe('4. ');
  });

  it('keeps indentation', () => {
    expect(listContinuation('  - uno')).toBe('  - ');
  });

  it('returns an empty string for an empty list item so Enter closes the list', () => {
    expect(listContinuation('- ')).toBe('');
  });

  it('returns null for a non-list line', () => {
    expect(listContinuation('texto normal')).toBeNull();
  });

  it('continues a blockquote', () => {
    expect(listContinuation('> cita')).toBe('> ');
  });
});

describe('continueList', () => {
  it('inserts a new bullet on Enter', () => {
    const v = view('- uno', 5);
    expect(continueList(v)).toBe(true);
    expect(v.state.doc.toString()).toBe('- uno\n- ');
  });

  it('clears the item and does not add a bullet when the item is empty', () => {
    const v = view('- uno\n- ', 8);
    expect(continueList(v)).toBe(true);
    expect(v.state.doc.toString()).toBe('- uno\n');
  });

  it('declines a plain line so the default Enter runs', () => {
    const v = view('texto', 5);
    expect(continueList(v)).toBe(false);
  });

  it('declines when there is a selection', () => {
    const v = view('- uno', 2, 5);
    expect(continueList(v)).toBe(false);
  });
});

describe('buildTable', () => {
  it('builds a header, a divider and the requested body rows', () => {
    expect(buildTable(2, 2).split('\n')).toHaveLength(4);
  });

  it('names the columns', () => {
    expect(buildTable(1, 3)).toContain('Columna 3');
  });

  it('never builds a table narrower than one column', () => {
    expect(buildTable(1, 0)).toContain('Columna 1');
  });
});

describe('insertTable', () => {
  it('inserts a table on an empty document', () => {
    const v = view('', 0);
    insertTable(v, 1, 2);
    expect(v.state.doc.toString()).toContain('| --- | --- |');
  });

  it('separates the table from text already on the line', () => {
    const v = view('texto', 5);
    insertTable(v, 1, 2);
    expect(v.state.doc.toString().startsWith('texto\n\n|')).toBe(true);
  });
});

describe('insertHorizontalRule', () => {
  it('inserts a rule', () => {
    const v = view('', 0);
    insertHorizontalRule(v);
    expect(v.state.doc.toString().trim()).toBe('---');
  });
});

describe('insertCodeBlock', () => {
  it('wraps the selection in a fence', () => {
    const v = view('const a = 1;', 0, 12);
    insertCodeBlock(v, 'js');
    expect(v.state.doc.toString()).toBe('```js\nconst a = 1;\n```\n');
  });

  it('creates an empty fence when nothing is selected', () => {
    const v = view('', 0);
    insertCodeBlock(v);
    expect(v.state.doc.toString()).toBe('```\n\n```\n');
  });
});

describe('insertImage', () => {
  it('uses the selection as the alt text', () => {
    const v = view('foto', 0, 4);
    insertImage(v, 'a.png');
    expect(v.state.doc.toString()).toBe('![foto](a.png)');
  });

  it('places the cursor in the alt text when nothing is selected', () => {
    const v = view('', 0);
    insertImage(v);
    expect(v.state.doc.toString()).toBe('![]()');
    expect(v.state.selection.main.head).toBe(2);
  });
});

describe('blockRangeAt', () => {
  const doc = '# Titulo\n\nParrafo uno\nsigue aqui\n\n```js\nconst a = 1;\n```\n\nFinal\n';

  it('returns the single line of a heading', () => {
    expect(blockRangeAt(doc, 0)).toEqual({ start: 0, end: 0 });
  });

  it('groups the lines of a paragraph', () => {
    expect(blockRangeAt(doc, 3)).toEqual({ start: 2, end: 3 });
  });

  it('returns the whole fenced block from any line inside it', () => {
    expect(blockRangeAt(doc, 6)).toEqual({ start: 5, end: 7 });
  });

  it('returns the blank line itself', () => {
    expect(blockRangeAt(doc, 1)).toEqual({ start: 1, end: 1 });
  });

  it('clamps a line past the end', () => {
    expect(blockRangeAt(doc, 999).end).toBeLessThan(doc.split('\n').length);
  });

  it('handles an empty document', () => {
    expect(blockRangeAt('', 0)).toEqual({ start: 0, end: 0 });
  });

  const list = '- uno\n- dos\n- tres\n';

  it('returns only the list item under the cursor', () => {
    expect(blockRangeAt(list, 1)).toEqual({ start: 1, end: 1 });
  });

  it('returns the first item without swallowing the rest', () => {
    expect(blockRangeAt(list, 0)).toEqual({ start: 0, end: 0 });
  });

  it('keeps a wrapped continuation line with its item', () => {
    const wrapped = '- uno\n  sigue\n- dos\n';
    expect(blockRangeAt(wrapped, 0)).toEqual({ start: 0, end: 1 });
  });

  it('keeps a nested item with its parent', () => {
    const nested = '- uno\n  - anidado\n- dos\n';
    expect(blockRangeAt(nested, 0)).toEqual({ start: 0, end: 1 });
  });

  it('returns the nested item alone when the cursor is on it', () => {
    const nested = '- uno\n  - anidado\n- dos\n';
    expect(blockRangeAt(nested, 1)).toEqual({ start: 1, end: 1 });
  });

  it('treats an ordered list the same way', () => {
    const ordered = '1. uno\n2. dos\n';
    expect(blockRangeAt(ordered, 1)).toEqual({ start: 1, end: 1 });
  });

  it('returns a single task item', () => {
    const tasks = '- [ ] uno\n- [x] dos\n';
    expect(blockRangeAt(tasks, 0)).toEqual({ start: 0, end: 0 });
  });
});

describe('selectedWordCount', () => {
  it('is zero without a selection', () => {
    expect(selectedWordCount(view('uno dos', 0))).toBe(0);
  });

  it('counts the words inside the selection', () => {
    expect(selectedWordCount(view('uno dos tres', 0, 7))).toBe(2);
  });
});
