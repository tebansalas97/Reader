export function parseRange(text: string, count: number): number[] {
  const clean = text.trim();
  if (clean === '') return Array.from({ length: count }, (_, index) => index + 1);

  const chosen = new Set<number>();
  for (const piece of clean.split(/[,;]/)) {
    const part = piece.trim();
    if (part === '') continue;

    const span = /^(\d*)\s*-\s*(\d*)$/.exec(part);
    if (span) {
      const from = span[1] === '' ? 1 : Number(span[1]);
      const to = span[2] === '' ? count : Number(span[2]);
      const first = Math.max(1, Math.min(from, to));
      const last = Math.min(count, Math.max(from, to));
      for (let page = first; page <= last; page += 1) chosen.add(page);
      continue;
    }

    const single = Number(part);
    if (Number.isInteger(single) && single >= 1 && single <= count) chosen.add(single);
  }

  return [...chosen].sort((a, b) => a - b);
}

export function rangeText(positions: readonly number[]): string {
  const sorted = [...new Set(positions)].sort((a, b) => a - b);
  const pieces: string[] = [];
  let start: number | null = null;
  let previous: number | null = null;

  for (const page of sorted) {
    if (start === null || previous === null) {
      start = page;
      previous = page;
      continue;
    }
    if (page === previous + 1) {
      previous = page;
      continue;
    }
    pieces.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = page;
    previous = page;
  }

  if (start !== null && previous !== null) {
    pieces.push(start === previous ? `${start}` : `${start}-${previous}`);
  }
  return pieces.join(',');
}
