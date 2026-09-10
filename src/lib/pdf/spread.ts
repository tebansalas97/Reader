export type ReadMode = 'continuous' | 'single' | 'double';

export const READ_MODES: ReadMode[] = ['continuous', 'single', 'double'];

export function nextMode(mode: ReadMode): ReadMode {
  const index = READ_MODES.indexOf(mode);
  return READ_MODES[(index + 1) % READ_MODES.length]!;
}

export function rowsFor(mode: ReadMode, count: number, current: number): number[][] {
  if (count <= 0) return [];
  if (mode === 'single') {
    const index = Math.min(Math.max(0, current - 1), count - 1);
    return [[index]];
  }
  if (mode === 'double') {
    const rows: number[][] = [];
    for (let index = 0; index < count; index += 2) {
      rows.push(index + 1 < count ? [index, index + 1] : [index]);
    }
    return rows;
  }
  return Array.from({ length: count }, (_, index) => [index]);
}

export function rowHeights(rows: number[][], heights: number[]): number[] {
  return rows.map((row) => Math.max(0, ...row.map((index) => heights[index] ?? 0)));
}

export function rowWidths(rows: number[][], widths: number[], gap: number): number[] {
  return rows.map((row) => {
    const sum = row.reduce((total, index) => total + (widths[index] ?? 0), 0);
    return sum + gap * Math.max(0, row.length - 1);
  });
}

export function rowOfPage(rows: number[][], index: number): number {
  const found = rows.findIndex((row) => row.includes(index));
  return found === -1 ? 0 : found;
}

export function pageOfRow(rows: number[][], row: number): number {
  return (rows[row]?.[0] ?? 0) + 1;
}

export function pageStep(mode: ReadMode, page: number, count: number, forward: boolean): number {
  const step = mode === 'double' ? 2 : 1;
  const next = forward ? page + step : page - step;
  return Math.min(Math.max(1, next), Math.max(1, count));
}
