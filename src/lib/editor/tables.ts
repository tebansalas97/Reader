export interface TableBlock {
  start: number;
  end: number;
  rows: string[];
}

const ROW = /^\s*\|.*\|\s*$/;
const DIVIDER = /^\s*\|[\s:|-]+\|\s*$/;

export function isTableRow(line: string): boolean {
  return ROW.test(line);
}

export function tableAt(lines: string[], line: number): TableBlock | null {
  if (line < 0 || line >= lines.length) return null;
  if (!isTableRow(lines[line] ?? '')) return null;
  let start = line;
  while (start > 0 && isTableRow(lines[start - 1] ?? '')) start -= 1;
  let end = line;
  while (end < lines.length - 1 && isTableRow(lines[end + 1] ?? '')) end += 1;
  if (end - start < 1) return null;
  return { start, end, rows: lines.slice(start, end + 1) };
}

export function splitRow(row: string): string[] {
  const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let current = '';
  let escaped = false;
  for (const character of trimmed) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === '\\') {
      current += character;
      escaped = true;
      continue;
    }
    if (character === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  cells.push(current.trim());
  return cells;
}

export type Alignment = 'left' | 'center' | 'right';

export function alignmentsOf(divider: string): Alignment[] {
  return splitRow(divider).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });
}

function visualWidth(value: string): number {
  return Array.from(value).length;
}

function pad(value: string, width: number, alignment: Alignment): string {
  const missing = Math.max(0, width - visualWidth(value));
  if (alignment === 'right') return ' '.repeat(missing) + value;
  if (alignment === 'center') {
    const left = Math.floor(missing / 2);
    return ' '.repeat(left) + value + ' '.repeat(missing - left);
  }
  return value + ' '.repeat(missing);
}

function dividerCell(width: number, alignment: Alignment): string {
  const size = Math.max(3, width);
  if (alignment === 'center') return `:${'-'.repeat(size - 2)}:`;
  if (alignment === 'right') return `${'-'.repeat(size - 1)}:`;
  return '-'.repeat(size);
}

export function formatTable(rows: string[]): string[] {
  if (rows.length < 2) return rows;
  const grid = rows.map(splitRow);
  const dividerIndex = rows.findIndex((row) => DIVIDER.test(row));
  const alignments = dividerIndex >= 0 ? alignmentsOf(rows[dividerIndex]!) : [];
  const columns = Math.max(...grid.map((row) => row.length));
  const widths: number[] = [];
  for (let column = 0; column < columns; column += 1) {
    let width = 3;
    for (let row = 0; row < grid.length; row += 1) {
      if (row === dividerIndex) continue;
      width = Math.max(width, visualWidth(grid[row]![column] ?? ''));
    }
    widths.push(width);
  }
  return grid.map((cells, index) => {
    if (index === dividerIndex) {
      const parts = widths.map((width, column) =>
        dividerCell(width, alignments[column] ?? 'left'),
      );
      return `| ${parts.join(' | ')} |`;
    }
    const parts = widths.map((width, column) =>
      pad(cells[column] ?? '', width, alignments[column] ?? 'left'),
    );
    return `| ${parts.join(' | ')} |`;
  });
}

export function formatTablesIn(text: string): string {
  const lines = text.split('\n');
  const output: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const block = tableAt(lines, index);
    if (!block || block.start !== index) {
      output.push(lines[index]!);
      index += 1;
      continue;
    }
    output.push(...formatTable(block.rows));
    index = block.end + 1;
  }
  return output.join('\n');
}

export interface CellPosition {
  row: number;
  column: number;
}

export function cellBoundaries(row: string): Array<{ from: number; to: number }> {
  const bounds: Array<{ from: number; to: number }> = [];
  let cellStart: number | null = null;
  let escaped = false;
  for (let i = 0; i < row.length; i += 1) {
    const character = row[i]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character !== '|') continue;
    if (cellStart !== null) bounds.push({ from: cellStart, to: i });
    cellStart = i + 1;
  }
  return bounds;
}

export function nextCell(
  row: string,
  column: number,
  direction: 1 | -1,
): { from: number; to: number } | null {
  const bounds = cellBoundaries(row);
  const current = bounds.findIndex((b) => column >= b.from && column <= b.to);
  const index = current < 0 ? (direction === 1 ? 0 : bounds.length - 1) : current + direction;
  const target = bounds[index];
  if (!target) return null;
  let from = target.from;
  let to = target.to;
  while (from < to && row[from] === ' ') from += 1;
  while (to > from && row[to - 1] === ' ') to -= 1;
  return { from, to };
}
