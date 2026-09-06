import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import type { Prefs } from '$lib/state/prefs.svelte';

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.45em', fontWeight: '700', color: 'var(--text)' },
  { tag: tags.heading2, fontSize: '1.28em', fontWeight: '700', color: 'var(--text)' },
  { tag: tags.heading3, fontSize: '1.14em', fontWeight: '600', color: 'var(--text)' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600', color: 'var(--text)' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--text-muted)' },
  { tag: tags.link, color: 'var(--accent)' },
  { tag: tags.url, color: 'var(--text-faint)' },
  { tag: tags.monospace, color: 'var(--warning)' },
  { tag: tags.quote, color: 'var(--text-muted)', fontStyle: 'italic' },
  { tag: tags.list, color: 'var(--accent)' },
  { tag: tags.processingInstruction, color: 'var(--text-faint)' },
  { tag: tags.contentSeparator, color: 'var(--border-strong)' },
  { tag: tags.keyword, color: 'var(--accent)' },
  { tag: tags.string, color: 'var(--warning)' },
  { tag: tags.number, color: 'var(--warning)' },
  { tag: tags.comment, color: 'var(--text-faint)', fontStyle: 'italic' },
  { tag: tags.typeName, color: 'var(--accent)' },
  { tag: tags.variableName, color: 'var(--text)' },
]);

export function editorTheme(theme: 'light' | 'dark', prefs: Prefs): Extension {
  return [
    EditorView.theme(
      {
        '&': {
          height: '100%',
          fontSize: `${prefs.editorFontSize}px`,
          backgroundColor: 'var(--bg)',
          color: 'var(--text)',
        },
        '.cm-content': {
          fontFamily: prefs.editorFont,
          padding: '16px 0 40vh 0',
          caretColor: 'var(--accent)',
          userSelect: 'text',
        },
        '.cm-scroller': { fontFamily: prefs.editorFont, lineHeight: '1.65' },
        '.cm-gutters': {
          backgroundColor: 'var(--bg)',
          color: 'var(--text-faint)',
          border: 'none',
        },
        '.cm-activeLine': { backgroundColor: 'var(--bg-inset)' },
        '.cm-activeLineGutter': { backgroundColor: 'var(--bg-inset)' },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
          backgroundColor: 'var(--selection)',
        },
        '.cm-cursor, .cm-dropCursor': {
          borderLeftColor: 'var(--accent)',
          borderLeftWidth: '2px',
        },
        '.cm-panels': {
          backgroundColor: 'var(--bg-elevated)',
          color: 'var(--text)',
          borderBottom: '1px solid var(--border)',
        },
        '.cm-panel input, .cm-panel button': {
          backgroundColor: 'var(--bg-inset)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '2px 6px',
        },
        '.cm-searchMatch': { backgroundColor: 'var(--selection)' },
        '.cm-searchMatch.cm-searchMatch-selected': {
          backgroundColor: 'var(--accent)',
          color: 'var(--accent-contrast)',
        },
        '.cm-selectionMatch': { backgroundColor: 'var(--bg-hover)' },
        '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
          backgroundColor: 'var(--accent-soft)',
          outline: '1px solid var(--accent)',
        },
      },
      { dark: theme === 'dark' },
    ),
    syntaxHighlighting(markdownHighlight),
  ];
}
