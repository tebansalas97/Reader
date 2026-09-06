export interface WordToken {
  from: number;
  to: number;
  word: string;
}

const WORD_PATTERN = /[\p{L}][\p{L}\p{M}'’-]*/gu;

const SKIP_PATTERNS: RegExp[] = [
  /```[\s\S]*?(?:```|$)/g,
  /~~~[\s\S]*?(?:~~~|$)/g,
  /`[^`\n]*`/g,
  /^ {4,}\S.*$/gm,
  /\$\$[\s\S]*?\$\$/g,
  /\$[^$\n]+\$/g,
  /\]\([^)\n]*\)/g,
  /\]\[[^\]\n]*\]/g,
  /<[^>\n]+>/g,
  /(?:https?:\/\/|www\.)\S+/g,
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
  /^\s{0,3}(?:---|===|\*\*\*)\s*$/gm,
];

export function maskedRegions(text: string): Array<[number, number]> {
  const regions: Array<[number, number]> = [];
  for (const pattern of SKIP_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match !== null) {
      if (match[0].length > 0) regions.push([match.index, match.index + match[0].length]);
      if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
      match = pattern.exec(text);
    }
  }
  regions.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const region of regions) {
    const last = merged[merged.length - 1];
    if (last && region[0] <= last[1]) last[1] = Math.max(last[1], region[1]);
    else merged.push([region[0], region[1]]);
  }
  return merged;
}

function insideAny(regions: Array<[number, number]>, from: number, to: number): boolean {
  for (const [start, end] of regions) {
    if (start >= to) return false;
    if (from >= start && to <= end) return true;
  }
  return false;
}

export function isCheckable(word: string): boolean {
  if (word.length < 3) return false;
  if (/\d/.test(word)) return false;
  if (word === word.toUpperCase() && word.length <= 5) return false;
  return true;
}

export function tokenizeWords(text: string, offset = 0): WordToken[] {
  const regions = maskedRegions(text);
  const tokens: WordToken[] = [];
  WORD_PATTERN.lastIndex = 0;
  let match = WORD_PATTERN.exec(text);
  while (match !== null) {
    const raw = match[0].replace(/[-'’]+$/, '');
    if (raw.length > 0) {
      const from = match.index;
      const to = from + raw.length;
      if (isCheckable(raw) && !insideAny(regions, from, to)) {
        tokens.push({ from: from + offset, to: to + offset, word: raw });
      }
    }
    match = WORD_PATTERN.exec(text);
  }
  return tokens;
}

export function normaliseWord(word: string): string {
  return word.replace(/’/g, "'");
}
