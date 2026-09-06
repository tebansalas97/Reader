<script lang="ts">
  import { redo, undo } from '@codemirror/commands';
  import { openSearchPanel } from '@codemirror/search';
  import { EditorSelection } from '@codemirror/state';
  import type { EditorView } from '@codemirror/view';
  import { untrack } from 'svelte';
  import {
    blockRangeAt,
    insertCodeBlock,
    insertHorizontalRule,
    insertImage,
    insertLink,
    insertTable,
    selectedWordCount,
    toggleHeading,
    toggleLinePrefix,
    toggleWrap,
  } from '$lib/editor/commands';
  import { createEditor, reconfigureEditor, setEditorReadOnly } from '$lib/editor/create';
  import { toggleTaskAtLine } from '$lib/editor/selection';
  import { documents } from '$lib/state/documents.svelte';
  import { prefs, resolvedTheme } from '$lib/state/prefs.svelte';

  interface Props {
    docId: string;
    onpasteimage?: (file: File) => void;
    onscrollline?: (line: number) => void;
    onblock?: (start: number, end: number) => void;
    onselection?: (words: number) => void;
    onfragment?: (text: string) => void;
  }

  const { docId, onpasteimage, onscrollline, onblock, onselection, onfragment }: Props =
    $props();

  let host = $state<HTMLElement | null>(null);
  let view: EditorView | null = $state(null);
  let applying = false;

  function reportContext(instance: EditorView, line: number): void {
    const text = instance.state.doc.toString();
    const range = blockRangeAt(text, line - 1);
    onblock?.(range.start, range.end);
    onselection?.(selectedWordCount(instance));
    const main = instance.state.selection.main;
    onfragment?.(main.empty ? '' : instance.state.sliceDoc(main.from, main.to));
  }

  $effect(() => {
    const node = host;
    if (!node) return;
    const initial = untrack(() => {
      const doc = documents.byId(docId);
      return {
        text: doc?.text ?? '',
        readOnly: doc?.readOnly ?? false,
        prefs: prefs.current,
        theme: resolvedTheme(),
      };
    });
    const instance = createEditor({
      parent: node,
      doc: initial.text,
      prefs: initial.prefs,
      theme: initial.theme,
      readOnly: initial.readOnly,
      onChange: (text) => {
        if (applying) return;
        documents.setText(docId, text);
      },
      onCursor: (line, col) => {
        documents.setCursor(docId, line, col);
        reportContext(instance, line);
      },
      onScrollLine: (line) => {
        documents.setScrollLine(docId, line);
        onscrollline?.(line);
      },
      onPasteImage: onpasteimage,
    });
    view = instance;
    instance.focus();
    reportContext(instance, 1);
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
    const instance = untrack(() => view);
    if (instance) reconfigureEditor(instance, prefs.current, theme);
  });

  $effect(() => {
    const readOnly = documents.byId(docId)?.readOnly ?? false;
    const instance = untrack(() => view);
    if (instance) setEditorReadOnly(instance, readOnly);
  });

  $effect(() => {
    const text = documents.byId(docId)?.text;
    const instance = untrack(() => view);
    if (instance === null || text === undefined) return;
    if (text === instance.state.doc.toString()) return;
    const previous = instance.state.selection.main;
    const scrollTop = instance.scrollDOM.scrollTop;
    const anchor = Math.min(previous.anchor, text.length);
    const head = Math.min(previous.head, text.length);
    applying = true;
    instance.dispatch({
      changes: { from: 0, to: instance.state.doc.length, insert: text },
      selection: EditorSelection.range(anchor, head),
    });
    applying = false;
    instance.scrollDOM.scrollTop = scrollTop;
  });

  export function focus(): void {
    view?.focus();
  }

  export function scrollToLine(line: number): void {
    const instance = view;
    if (!instance) return;
    const target = Math.min(Math.max(1, line + 1), instance.state.doc.lines);
    instance.scrollDOM.scrollTop = instance.lineBlockAt(instance.state.doc.line(target).from).top;
  }

  export function moveCursorToLine(line: number): void {
    const instance = view;
    if (!instance) return;
    const target = Math.min(Math.max(1, line + 1), instance.state.doc.lines);
    const pos = instance.state.doc.line(target).from;
    instance.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    instance.focus();
  }

  export function selectLines(start: number, end: number): void {
    const instance = view;
    if (!instance) return;
    const total = instance.state.doc.lines;
    const first = instance.state.doc.line(Math.min(Math.max(1, start + 1), total));
    const last = instance.state.doc.line(Math.min(Math.max(1, end + 1), total));
    instance.dispatch({
      selection: EditorSelection.range(first.from, last.to),
      scrollIntoView: true,
    });
    instance.focus();
  }

  export function toggleTask(line: number): void {
    const instance = view;
    if (!instance) return;
    const updated = toggleTaskAtLine(instance.state.doc.toString(), line);
    if (updated === null) return;
    const selection = instance.state.selection.main;
    instance.dispatch({
      changes: { from: 0, to: instance.state.doc.length, insert: updated },
      selection: { anchor: Math.min(selection.anchor, updated.length) },
    });
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

  export function run(action: string, argument?: string | number): void {
    const instance = view;
    if (!instance) return;
    switch (action) {
      case 'undo':
        undo(instance);
        break;
      case 'redo':
        redo(instance);
        break;
      case 'bold':
        toggleWrap(instance, '**');
        break;
      case 'italic':
        toggleWrap(instance, '*');
        break;
      case 'strike':
        toggleWrap(instance, '~~');
        break;
      case 'code':
        toggleWrap(instance, '`');
        break;
      case 'heading':
        toggleHeading(instance, Number(argument ?? 1));
        break;
      case 'bullet':
        toggleLinePrefix(instance, '- ');
        break;
      case 'ordered':
        toggleLinePrefix(instance, '1. ');
        break;
      case 'task':
        toggleLinePrefix(instance, '- [ ] ');
        break;
      case 'quote':
        toggleLinePrefix(instance, '> ');
        break;
      case 'link':
        insertLink(instance, typeof argument === 'string' ? argument : '');
        break;
      case 'image':
        insertImage(instance, typeof argument === 'string' ? argument : '');
        break;
      case 'table':
        insertTable(instance);
        break;
      case 'codeBlock':
        insertCodeBlock(instance, typeof argument === 'string' ? argument : '');
        break;
      case 'rule':
        insertHorizontalRule(instance);
        break;
      case 'find':
        openSearchPanel(instance);
        break;
      default:
        break;
    }
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
