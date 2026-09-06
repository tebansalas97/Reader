import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { bracketMatching, indentUnit } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import type { Prefs } from '$lib/state/prefs.svelte';
import { insertLink } from './commands';
import { readerKeymap } from './keymap';
import { editorTheme } from './theme';

export interface CreateEditorOptions {
  parent: HTMLElement;
  doc: string;
  prefs: Prefs;
  theme: 'light' | 'dark';
  readOnly?: boolean;
  onChange: (text: string) => void;
  onCursor: (line: number, col: number) => void;
  onScrollLine: (line: number) => void;
  onPasteImage?: (file: File) => void;
}

const themeCompartment = new Compartment();
const wrapCompartment = new Compartment();
const gutterCompartment = new Compartment();
const tabCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

const URL_ONLY = /^https?:\/\/\S+$/;

export function createEditor(options: CreateEditorOptions): EditorView {
  const { parent, doc, prefs, theme, onChange, onCursor, onScrollLine, onPasteImage } = options;

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) onChange(update.state.doc.toString());
    if (update.selectionSet || update.docChanged) {
      const head = update.state.selection.main.head;
      const line = update.state.doc.lineAt(head);
      onCursor(line.number, head - line.from + 1);
    }
  });

  const domHandlers = EditorView.domEventHandlers({
    scroll(_event, view) {
      const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop);
      onScrollLine(view.state.doc.lineAt(block.from).number - 1);
    },
    paste(event, view) {
      const data = event.clipboardData;
      if (!data) return false;
      const image = Array.from(data.files).find((f) => f.type.startsWith('image/'));
      if (image && onPasteImage) {
        event.preventDefault();
        onPasteImage(image);
        return true;
      }
      const text = data.getData('text/plain');
      if (!URL_ONLY.test(text)) return false;
      if (view.state.selection.main.empty) return false;
      event.preventDefault();
      insertLink(view, text);
      return true;
    },
  });

  const state = EditorState.create({
    doc,
    extensions: [
      history(),
      drawSelection(),
      dropCursor(),
      bracketMatching(),
      closeBrackets(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      highlightSelectionMatches(),
      search({ top: true }),
      markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: false }),
      keymap.of([
        ...readerKeymap,
        ...closeBracketsKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...defaultKeymap,
      ]),
      gutterCompartment.of(prefs.lineNumbers ? lineNumbers() : []),
      wrapCompartment.of(prefs.wordWrap ? EditorView.lineWrapping : []),
      tabCompartment.of([
        EditorState.tabSize.of(prefs.tabSize),
        indentUnit.of(' '.repeat(prefs.tabSize)),
      ]),
      readOnlyCompartment.of(EditorState.readOnly.of(options.readOnly ?? false)),
      themeCompartment.of(editorTheme(theme, prefs)),
      updateListener,
      domHandlers,
    ],
  });

  return new EditorView({ state, parent });
}

export function reconfigureEditor(view: EditorView, prefs: Prefs, theme: 'light' | 'dark'): void {
  view.dispatch({
    effects: [
      themeCompartment.reconfigure(editorTheme(theme, prefs)),
      wrapCompartment.reconfigure(prefs.wordWrap ? EditorView.lineWrapping : []),
      gutterCompartment.reconfigure(prefs.lineNumbers ? lineNumbers() : []),
      tabCompartment.reconfigure([
        EditorState.tabSize.of(prefs.tabSize),
        indentUnit.of(' '.repeat(prefs.tabSize)),
      ]),
    ],
  });
}

export function setEditorReadOnly(view: EditorView, readOnly: boolean): void {
  view.dispatch({ effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)) });
}
