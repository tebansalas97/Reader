import { EditorSelection, type ChangeSpec } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

export interface WrapResult {
  text: string;
  from: number;
  to: number;
  unwrapped: boolean;
}

export function wrapSelection(doc: string, from: number, to: number, marker: string): WrapResult {
  const selected = doc.slice(from, to);
  const before = doc.slice(Math.max(0, from - marker.length), from);
  const after = doc.slice(to, to + marker.length);
  if (before === marker && after === marker) {
    return { text: selected, from: from - marker.length, to: to + marker.length, unwrapped: true };
  }
  if (
    selected.length >= marker.length * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    return { text: selected.slice(marker.length, -marker.length), from, to, unwrapped: true };
  }
  return { text: `${marker}${selected}${marker}`, from, to, unwrapped: false };
}

export function toggleWrap(view: EditorView, marker: string): boolean {
  const doc = view.state.doc.toString();
  const transaction = view.state.changeByRange((range) => {
    const result = wrapSelection(doc, range.from, range.to, marker);
    const anchor = result.unwrapped ? result.from : result.from + marker.length;
    const head = anchor + (result.unwrapped ? result.text.length : range.to - range.from);
    return {
      changes: { from: result.from, to: result.to, insert: result.text },
      range: EditorSelection.range(anchor, head),
    };
  });
  view.dispatch(transaction, { scrollIntoView: true });
  view.focus();
  return true;
}

export function headingLine(line: string, level: number): string {
  const m = /^(#{1,6})\s+(.*)$/.exec(line);
  const hashes = '#'.repeat(level);
  if (m) {
    return m[1]!.length === level ? m[2]! : `${hashes} ${m[2]!}`;
  }
  return `${hashes} ${line}`;
}

function eachSelectedLine(view: EditorView, transform: (text: string) => string): boolean {
  const changes: ChangeSpec[] = [];
  const seen = new Set<number>();
  for (const range of view.state.selection.ranges) {
    const first = view.state.doc.lineAt(range.from).number;
    const last = view.state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n += 1) {
      if (seen.has(n)) continue;
      seen.add(n);
      const line = view.state.doc.line(n);
      changes.push({ from: line.from, to: line.to, insert: transform(line.text) });
    }
  }
  view.dispatch({ changes }, { scrollIntoView: true });
  view.focus();
  return true;
}

export function toggleHeading(view: EditorView, level: number): boolean {
  return eachSelectedLine(view, (text) => headingLine(text, level));
}

export function linePrefixToggle(line: string, prefix: string): string {
  const indent = /^\s*/.exec(line)?.[0] ?? '';
  const body = line.slice(indent.length);
  if (body.startsWith(prefix)) return indent + body.slice(prefix.length);
  return indent + prefix + body;
}

export function toggleLinePrefix(view: EditorView, prefix: string): boolean {
  return eachSelectedLine(view, (text) => linePrefixToggle(text, prefix));
}

export function insertLink(view: EditorView, url = ''): boolean {
  const transaction = view.state.changeByRange((range) => {
    const label = view.state.sliceDoc(range.from, range.to);
    const insert = `[${label}](${url})`;
    const cursor =
      label.length === 0 ? range.from + 1 : range.from + label.length + 3 + url.length;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(cursor),
    };
  });
  view.dispatch(transaction, { scrollIntoView: true });
  view.focus();
  return true;
}

const BULLET = /^(\s*)([-*+])\s+(\[[ xX]\]\s+)?(.*)$/;
const ORDERED = /^(\s*)(\d+)([.)])\s+(.*)$/;
const QUOTE = /^(\s*)>\s?(.*)$/;

export function listContinuation(line: string): string | null {
  const bullet = BULLET.exec(line);
  if (bullet) {
    if ((bullet[4] ?? '').trim().length === 0) return '';
    const task = bullet[3] ? '[ ] ' : '';
    return `${bullet[1]}${bullet[2]} ${task}`;
  }
  const ordered = ORDERED.exec(line);
  if (ordered) {
    if ((ordered[4] ?? '').trim().length === 0) return '';
    return `${ordered[1]}${Number(ordered[2]) + 1}${ordered[3]} `;
  }
  const quote = QUOTE.exec(line);
  if (quote) {
    if ((quote[2] ?? '').trim().length === 0) return '';
    return `${quote[1]}> `;
  }
  return null;
}

export function continueList(view: EditorView): boolean {
  const range = view.state.selection.main;
  if (!range.empty) return false;
  const line = view.state.doc.lineAt(range.head);
  const continuation = listContinuation(line.text);
  if (continuation === null) return false;
  if (continuation === '') {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: EditorSelection.cursor(line.from),
      scrollIntoView: true,
    });
    return true;
  }
  view.dispatch({
    changes: { from: range.head, to: range.head, insert: `\n${continuation}` },
    selection: EditorSelection.cursor(range.head + 1 + continuation.length),
    scrollIntoView: true,
  });
  return true;
}
