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

export function buildTable(rows: number, columns: number): string {
  const width = Math.max(1, columns);
  const body = Math.max(1, rows);
  const header = `| ${Array.from({ length: width }, (_, i) => `Columna ${i + 1}`).join(' | ')} |`;
  const divider = `| ${Array.from({ length: width }, () => '---').join(' | ')} |`;
  const line = `| ${Array.from({ length: width }, () => '   ').join(' | ')} |`;
  return [header, divider, ...Array.from({ length: body }, () => line)].join('\n');
}

function insertBlock(view: EditorView, block: string): boolean {
  const range = view.state.selection.main;
  const line = view.state.doc.lineAt(range.from);
  const atLineStart = range.from === line.from;
  const prefix = atLineStart ? '' : '\n';
  const needsBlank = line.text.trim().length > 0 ? `${prefix}\n` : prefix;
  const insert = `${needsBlank}${block}\n`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.cursor(range.from + insert.length),
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

export function insertTable(view: EditorView, rows = 2, columns = 3): boolean {
  return insertBlock(view, buildTable(rows, columns));
}

export function insertHorizontalRule(view: EditorView): boolean {
  return insertBlock(view, '---');
}

export function insertCodeBlock(view: EditorView, language = ''): boolean {
  const range = view.state.selection.main;
  const selected = view.state.sliceDoc(range.from, range.to);
  const body = selected.length > 0 ? selected : '';
  const block = `\`\`\`${language}\n${body}\n\`\`\``;
  const line = view.state.doc.lineAt(range.from);
  const prefix = range.from === line.from ? '' : '\n';
  const insert = `${prefix}${block}\n`;
  const cursor = range.from + prefix.length + 3 + language.length + 1;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.cursor(cursor + body.length),
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

export function insertImage(view: EditorView, url = '', alt = ''): boolean {
  const range = view.state.selection.main;
  const label = alt.length > 0 ? alt : view.state.sliceDoc(range.from, range.to);
  const insert = `![${label}](${url})`;
  const cursor = label.length === 0 ? range.from + 2 : range.from + insert.length;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.cursor(cursor),
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

const LIST_ITEM = /^(\s*)(?:[-*+]|\d+[.)])\s+/;

function itemIndent(line: string): number | null {
  const match = LIST_ITEM.exec(line);
  return match ? match[1]!.length : null;
}

export function blockRangeAt(text: string, line: number): { start: number; end: number } {
  const lines = text.split('\n');
  const clamped = Math.min(Math.max(0, line), Math.max(0, lines.length - 1));

  let inFence = false;
  let fenceStart = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^\s{0,3}(```|~~~)/.test(lines[i] ?? '')) continue;
    if (!inFence) {
      inFence = true;
      fenceStart = i;
      continue;
    }
    inFence = false;
    if (clamped >= fenceStart && clamped <= i) return { start: fenceStart, end: i };
  }

  if ((lines[clamped] ?? '').trim().length === 0) return { start: clamped, end: clamped };

  let start = clamped;
  while (start > 0 && (lines[start - 1] ?? '').trim().length > 0) {
    if (itemIndent(lines[start] ?? '') !== null) break;
    start -= 1;
  }

  const indent = itemIndent(lines[start] ?? '');
  if (indent === null) {
    let end = clamped;
    while (end < lines.length - 1 && (lines[end + 1] ?? '').trim().length > 0) {
      if (itemIndent(lines[end + 1] ?? '') !== null) break;
      end += 1;
    }
    return { start, end };
  }

  let end = start;
  while (end < lines.length - 1) {
    const next = lines[end + 1] ?? '';
    if (next.trim().length === 0) break;
    const nextIndent = itemIndent(next);
    if (nextIndent !== null && nextIndent <= indent) break;
    end += 1;
  }
  return { start, end };
}

export function selectedWordCount(view: EditorView): number {
  const range = view.state.selection.main;
  if (range.empty) return 0;
  const text = view.state.sliceDoc(range.from, range.to);
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'\u2019-]*/gu) ?? []).length;
}
