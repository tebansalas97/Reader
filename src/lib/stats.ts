export function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}'\u2019-]*/gu);
  return matches ? matches.length : 0;
}

export function countChars(text: string): number {
  return Array.from(text).length;
}

export function readingMinutes(words: number): number {
  if (words === 0) return 0;
  return Math.max(1, Math.ceil(words / 200));
}
