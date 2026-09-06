export interface TextRange {
  from: number;
  to: number;
}

const WORD = /[\p{L}\p{N}_]/u;

export function wordRangeAt(text: string, position: number): TextRange {
  const length = text.length;
  if (length === 0) return { from: 0, to: 0 };
  const pos = Math.min(Math.max(0, position), length);

  const isWord = (index: number) => index >= 0 && index < length && WORD.test(text[index]!);
  const isSpace = (index: number) => index >= 0 && index < length && /\s/.test(text[index]!);

  let start = pos;
  if (!isWord(start) && isWord(start - 1) && (isSpace(start) || start === length)) start -= 1;

  if (!isWord(start)) {
    if (start >= length || text[start] === '\n') return { from: pos, to: pos };
    return { from: start, to: start + 1 };
  }

  let end = start;
  while (isWord(start - 1)) start -= 1;
  while (isWord(end)) end += 1;
  return { from: start, to: end };
}

const TERMINATOR = /[.!?…]/;

export function sentenceRangeAt(text: string, position: number): TextRange {
  const length = text.length;
  if (length === 0) return { from: 0, to: 0 };
  const pos = Math.min(Math.max(0, position), length);

  let lineStart = pos;
  while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart -= 1;
  let lineEnd = pos;
  while (lineEnd < length && text[lineEnd] !== '\n') lineEnd += 1;

  let start = lineStart;
  for (let i = lineStart; i < pos; i += 1) {
    if (!TERMINATOR.test(text[i]!)) continue;
    let after = i + 1;
    while (after < lineEnd && TERMINATOR.test(text[after]!)) after += 1;
    if (after < lineEnd && !/\s/.test(text[after]!)) continue;
    while (after < lineEnd && /\s/.test(text[after]!)) after += 1;
    if (after <= pos) start = after;
  }

  let end = lineEnd;
  for (let i = Math.max(start, pos); i < lineEnd; i += 1) {
    if (!TERMINATOR.test(text[i]!)) continue;
    let after = i + 1;
    while (after < lineEnd && TERMINATOR.test(text[after]!)) after += 1;
    if (after < lineEnd && !/\s/.test(text[after]!)) continue;
    end = after;
    break;
  }

  while (start < end && /\s/.test(text[start]!)) start += 1;
  while (end > start && /\s/.test(text[end - 1]!)) end -= 1;
  if (start >= end) return { from: lineStart, to: lineEnd };
  return { from: start, to: end };
}

const TASK = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/;

export function isTaskLine(line: string): boolean {
  return TASK.test(line);
}

export function toggleTaskInLine(line: string): string | null {
  const match = TASK.exec(line);
  if (!match) return null;
  const next = match[2] === ' ' ? 'x' : ' ';
  return line.replace(TASK, `$1${next}$3`);
}

export function toggleTaskAtLine(text: string, line: number): string | null {
  const lines = text.split('\n');
  if (line < 0 || line >= lines.length) return null;
  const updated = toggleTaskInLine(lines[line]!);
  if (updated === null) return null;
  lines[line] = updated;
  return lines.join('\n');
}
