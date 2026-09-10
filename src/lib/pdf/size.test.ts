import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { makePdf } from '../../test/pdf-fixtures';
import { rectToQuad } from './annotations/geometry';
import type { Annotation } from './annotations/model';
import { readAnnotations } from './annotations/read';
import { openPdfDocument } from './document';
import { loadPdfjs } from './load';
import { initialPlan } from './pages';
import { buildSavedPdf } from './save';

beforeAll(async () => {
  const pdfjs = await loadPdfjs();
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'),
  ).href;
});

function marks(count: number): Annotation[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `a${index}`,
    page: 1,
    kind: 'highlight' as const,
    color: '#ffd400',
    opacity: 0.4,
    contents: `nota ${index}`,
    author: 'Esteban',
    createdMs: Date.UTC(2024, 0, 2),
    origin: 'reader' as const,
    quads: [rectToQuad({ x: 10, y: 700 - index * 14, width: 100, height: 12 })],
  }));
}

describe('el archivo guardado', () => {
  it('usa flujos de objetos, asi que ocupa menos', async () => {
    const bytes = await makePdf([{ text: 'UNO' }]);
    const saved = await buildSavedPdf({
      bytes,
      pages: initialPlan(1),
      savedPages: initialPlan(1),
      annotations: marks(30),
      savedAnnotations: [],
    });
    const text = new TextDecoder('latin1').decode(saved);
    expect(text).toContain('/ObjStm');
  });

  it('se sigue leyendo con todas sus anotaciones', async () => {
    const bytes = await makePdf([{ text: 'UNO' }]);
    const saved = await buildSavedPdf({
      bytes,
      pages: initialPlan(1),
      savedPages: initialPlan(1),
      annotations: marks(30),
      savedAnnotations: [],
    });
    const handle = await openPdfDocument(saved);
    const found = await readAnnotations(handle);
    await handle.destroy();
    expect(found).toHaveLength(30);
  });
});
