<script lang="ts">
  import type { EditorView } from '@codemirror/view';
  import { createEditor, reconfigureEditor, setEditorReadOnly } from '$lib/editor/create';
  import { documents } from '$lib/state/documents.svelte';
  import { prefs, resolvedTheme } from '$lib/state/prefs.svelte';

  interface Props {
    docId: string;
    onpasteimage?: (file: File) => void;
    onscrollline?: (line: number) => void;
  }

  const { docId, onpasteimage, onscrollline }: Props = $props();

  let host = $state<HTMLElement | null>(null);
  let view: EditorView | null = $state(null);
  let applying = false;

  $effect(() => {
    const node = host;
    if (!node) return;
    const doc = documents.byId(docId);
    if (!doc) return;
    const instance = createEditor({
      parent: node,
      doc: doc.text,
      prefs: prefs.current,
      theme: resolvedTheme(),
      readOnly: doc.readOnly,
      onChange: (text) => {
        if (applying) return;
        documents.setText(docId, text);
      },
      onCursor: (line, col) => documents.setCursor(docId, line, col),
      onScrollLine: (line) => {
        documents.setScrollLine(docId, line);
        onscrollline?.(line);
      },
      onPasteImage: onpasteimage,
    });
    view = instance;
    instance.focus();
    return () => {
      instance.destroy();
      view = null;
    };
  });

  $effect(() => {
    const size = prefs.current.editorFontSize;
    const wrap = prefs.current.wordWrap;
    const gutter = prefs.current.lineNumbers;
    const tab = prefs.current.tabSize;
    const family = prefs.current.editorFont;
    const theme = resolvedTheme();
    void size;
    void wrap;
    void gutter;
    void tab;
    void family;
    if (view) reconfigureEditor(view, prefs.current, theme);
  });

  $effect(() => {
    const doc = documents.byId(docId);
    if (view && doc) setEditorReadOnly(view, doc.readOnly);
  });

  $effect(() => {
    const doc = documents.byId(docId);
    const instance = view;
    if (!instance || !doc) return;
    if (doc.text === instance.state.doc.toString()) return;
    applying = true;
    instance.dispatch({
      changes: { from: 0, to: instance.state.doc.length, insert: doc.text },
    });
    applying = false;
  });

  export function focus(): void {
    view?.focus();
  }

  export function scrollToLine(line: number): void {
    const instance = view;
    if (!instance) return;
    const target = Math.min(Math.max(1, line + 1), instance.state.doc.lines);
    const pos = instance.state.doc.line(target).from;
    const top = instance.lineBlockAt(pos).top;
    instance.scrollDOM.scrollTop = top;
  }

  export function moveCursorToLine(line: number): void {
    const instance = view;
    if (!instance) return;
    const target = Math.min(Math.max(1, line + 1), instance.state.doc.lines);
    const pos = instance.state.doc.line(target).from;
    instance.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    instance.focus();
  }

  export function insertAtCursor(text: string): void {
    const instance = view;
    if (!instance) return;
    const range = instance.state.selection.main;
    instance.dispatch({
      changes: { from: range.from, to: range.to, insert: text },
      selection: { anchor: range.from + text.length },
    });
    instance.focus();
  }
</script>

<div class="editor" bind:this={host}></div>

<style>
  .editor {
    height: 100%;
    overflow: hidden;
  }

  .editor :global(.cm-editor) {
    height: 100%;
  }

  .editor :global(.cm-scroller) {
    overflow: auto;
  }
</style>
