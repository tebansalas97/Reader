import { describe, expect, it } from 'vitest';
import {
  alignmentsOf,
  cellBoundaries,
  formatTable,
  formatTablesIn,
  isTableRow,
  nextCell,
  splitRow,
  tableAt,
} from './tables';

describe('isTableRow', () => {
  it('accepts a row with pipes at both ends', () => {
    expect(isTableRow('| a | b |')).toBe(true);
  });

  it('rejects a plain paragraph', () => {
    expect(isTableRow('texto | con barra')).toBe(false);
  });
});

describe('splitRow', () => {
  it('splits the cells and trims them', () => {
    expect(splitRow('|  a  |  b  |')).toEqual(['a', 'b']);
  });

  it('keeps an escaped pipe inside a cell', () => {
    expect(splitRow('| a\\|b | c |')).toEqual(['a\\|b', 'c']);
  });

  it('keeps empty cells', () => {
    expect(splitRow('| a |  | c |')).toEqual(['a', '', 'c']);
  });
});

describe('alignmentsOf', () => {
  it('reads left, centre and right', () => {
    expect(alignmentsOf('| --- | :-: | ---: |')).toEqual(['left', 'center', 'right']);
  });
});

describe('tableAt', () => {
  const lines = ['texto', '| a | b |', '| - | - |', '| 1 | 2 |', 'final'];

  it('finds the table from any of its rows', () => {
    expect(tableAt(lines, 2)?.start).toBe(1);
    expect(tableAt(lines, 2)?.end).toBe(3);
  });

  it('returns null outside a table', () => {
    expect(tableAt(lines, 0)).toBeNull();
  });

  it('returns null for a single isolated row', () => {
    expect(tableAt(['| solo |'], 0)).toBeNull();
  });
});

describe('formatTable', () => {
  it('pads every column to the same width', () => {
    const out = formatTable(['| a | bbbb |', '| - | - |', '| ccc | d |']);
    const widths = out.map((row) => row.length);
    expect(new Set(widths).size).toBe(1);
  });

  it('keeps the header text', () => {
    const out = formatTable(['|a|b|', '|-|-|', '|1|2|']);
    expect(out[0]).toBe('| a   | b   |');
  });

  it('rebuilds the divider to match the widths', () => {
    const out = formatTable(['| aaaaa | b |', '| - | - |', '| 1 | 2 |']);
    expect(out[1]).toBe('| ----- | --- |');
  });

  it('keeps centre alignment', () => {
    const out = formatTable(['| a | b |', '| :-: | - |', '| 1 | 2 |']);
    expect(out[1]).toContain(':-:');
  });

  it('right aligns the cells of a right aligned column', () => {
    const out = formatTable(['| valor |', '| ---: |', '| 1 |']);
    expect(out[2]).toBe('|     1 |');
  });

  it('fills in a row that is missing cells', () => {
    const out = formatTable(['| a | b |', '| - | - |', '| 1 |']);
    expect(out[2]).toBe('| 1   |     |');
  });

  it('leaves a block that is not a table alone', () => {
    expect(formatTable(['| solo |'])).toEqual(['| solo |']);
  });
});

describe('formatTablesIn', () => {
  it('formats every table and leaves the rest untouched', () => {
    const text = 'antes\n\n|a|b|\n|-|-|\n|1|2|\n\ndespues';
    const out = formatTablesIn(text).split('\n');
    expect(out[0]).toBe('antes');
    expect(out[2]).toBe('| a   | b   |');
    expect(out[6]).toBe('despues');
  });

  it('leaves a document without tables byte for byte', () => {
    const text = '# Titulo\n\nUn parrafo.\n';
    expect(formatTablesIn(text)).toBe(text);
  });
});

describe('cellBoundaries', () => {
  it('reports one range per cell', () => {
    expect(cellBoundaries('| a | b |')).toHaveLength(2);
  });
});

describe('nextCell', () => {
  const row = '| uno | dos | tres |';

  it('moves to the following cell', () => {
    const target = nextCell(row, 3, 1);
    expect(row.slice(target!.from, target!.to)).toBe('dos');
  });

  it('moves to the previous cell', () => {
    const target = nextCell(row, 8, -1);
    expect(row.slice(target!.from, target!.to)).toBe('uno');
  });

  it('returns null past the last cell', () => {
    expect(nextCell(row, 16, 1)).toBeNull();
  });

  it('returns null before the first cell', () => {
    expect(nextCell(row, 3, -1)).toBeNull();
  });
});
