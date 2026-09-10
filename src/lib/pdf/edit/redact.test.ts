import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { makePdf } from '../../../test/pdf-fixtures';
import { loadForWriting, saveWritten } from '../annotations/write';
import { openPdfDocument } from '../document';
import { extractPageText } from '../search';
import { applyRedactions, readPageText } from './document';
import { loadPdfjs } from '../load';
import { coverStream, glyphBoxes, redactRun, touches } from './redact';

beforeAll(async () => {
  const pdfjs = await loadPdfjs();
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'),
  ).href;
});

describe('touches', () => {
  it('sees two boxes that overlap', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 5, y: 5, width: 10, height: 10 };
    expect(touches(a, b)).toBe(true);
  });

  it('sees two boxes apart', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 20, y: 20, width: 10, height: 10 };
    expect(touches(a, b)).toBe(false);
  });

  it('does not count a shared edge', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 10, y: 0, width: 10, height: 10 };
    expect(touches(a, b)).toBe(false);
  });
});

describe('coverStream', () => {
  it('paints a black box over the area', () => {
    const stream = coverStream([{ x: 10, y: 20, width: 30, height: 40 }]);
    expect(stream).toContain('0 g');
    expect(stream).toContain('10 20 30 40 re');
    expect(stream).toContain('f');
  });

  it('writes nothing without areas', () => {
    expect(coverStream([])).toBe('');
  });
});

async function firstRun() {
  const bytes = await makePdf([{ text: 'SECRETO VISIBLE' }]);
  const document = await loadForWriting(bytes);
  const page = (await readPageText(document, 1))!;
  const run = page.runs[0]!;
  return { run, font: page.fonts.get(run.font) ?? null, page };
}

describe('glyphBoxes', () => {
  it('gives one box per letter, in order', async () => {
    const { run, font } = await firstRun();
    const boxes = glyphBoxes(run, font);
    expect(boxes).toHaveLength(run.bytes.length);
    expect(boxes[1]!.box.x).toBeGreaterThan(boxes[0]!.box.x);
  });

  it('gives nothing without a font', async () => {
    const { run } = await firstRun();
    expect(glyphBoxes(run, null)).toEqual([]);
  });
});

describe('redactRun', () => {
  it('leaves alone a run that is outside the area', async () => {
    const { run, font } = await firstRun();
    expect(redactRun(run, font, [{ x: 0, y: 0, width: 5, height: 5 }])).toBeNull();
  });

  it('keeps the letters that stay outside', async () => {
    const { run, font } = await firstRun();
    const boxes = glyphBoxes(run, font);
    const first = boxes[0]!.box;
    const source = redactRun(run, font, [
      { x: first.x - 1, y: first.y - 1, width: first.width + 2, height: first.height + 2 },
    ]);
    expect(source).not.toBeNull();
    expect(source).toContain('VISIBLE');
    expect(source).not.toContain('SECRETO');
  });

  it('moves the pen the same distance it removed', async () => {
    const { run, font } = await firstRun();
    const boxes = glyphBoxes(run, font);
    const first = boxes[0]!.box;
    const source = redactRun(run, font, [
      { x: first.x - 1, y: first.y - 1, width: first.width + 2, height: first.height + 2 },
    ]);
    expect(source).toMatch(/^\[-\d/);
  });

  it('empties a run that falls fully inside', async () => {
    const { run, font } = await firstRun();
    const source = redactRun(run, font, [
      { x: 0, y: 0, width: 1000, height: 1000 },
    ]);
    expect(source).not.toContain('(');
    expect(source).toMatch(/^\[-\d+(\.\d+)?\] TJ$/);
  });
});

describe('applyRedactions', () => {
  it('borra de verdad el texto tapado', async () => {
    const bytes = await makePdf([{ text: 'SECRETO VISIBLE' }]);
    const document = await loadForWriting(bytes);
    await applyRedactions(document, [
      { page: 1, rect: { x: 0, y: 600, width: 612, height: 200 } },
    ]);
    const saved = await saveWritten(document);
    const handle = await openPdfDocument(saved);
    const text = await extractPageText(handle, 1);
    await handle.destroy();
    expect(text).not.toContain('SECRETO');
  });

  it('cuenta las imagenes que la redaccion no puede borrar', async () => {
    const bytes = await makePdf([{ text: 'SECRETO' }]);
    const document = await loadForWriting(bytes);
    const reports = await applyRedactions(document, [
      { page: 1, rect: { x: 0, y: 600, width: 612, height: 200 } },
    ]);
    expect(reports[0]?.images).toBe(0);
    expect(reports[0]?.runs).toBeGreaterThan(0);
  });

  it('no hace nada sin areas', async () => {
    const document = await loadForWriting(await makePdf([{ text: 'HOLA' }]));
    expect(await applyRedactions(document, [])).toEqual([]);
  });
});
