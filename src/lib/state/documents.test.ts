import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReaderError } from '$lib/fs/api-types';

const files = new Map<string, string>();

vi.mock('$lib/fs/api', () => ({
  readText: vi.fn(async (path: string) => {
    if (!files.has(path)) throw new ReaderError('NotFound', 'no existe', path);
    return { text: files.get(path)!, modifiedMs: 1, lineEnding: 'lf' as const };
  }),
  writeText: vi.fn(async (path: string, text: string) => {
    files.set(path, text);
    return 2;
  }),
  watch: vi.fn(async () => undefined),
  unwatch: vi.fn(async () => undefined),
  pushRecent: vi.fn(async () => []),
  exists: vi.fn(async (p: string) => files.has(p)),
}));

const { documents, kindForPath } = await import('./documents.svelte');
const api = await import('$lib/fs/api');

beforeEach(() => {
  files.clear();
  documents.reset();
  vi.clearAllMocks();
});

describe('open', () => {
  it('adds a document and makes it active', async () => {
    files.set('C:/d/a.md', '# hola');
    const id = await documents.open('C:/d/a.md');
    expect(documents.list).toHaveLength(1);
    expect(documents.activeId).toBe(id);
    expect(documents.activeMarkdown?.text).toBe('# hola');
  });

  it('uses the file name as the title', async () => {
    files.set('C:/d/a.md', '');
    await documents.open('C:/d/a.md');
    expect(documents.activeMarkdown?.title).toBe('a.md');
  });

  it('focuses the existing tab instead of opening a duplicate', async () => {
    files.set('C:/d/a.md', 'x');
    const first = await documents.open('C:/d/a.md');
    const second = await documents.open('C:/d/a.md');
    expect(second).toBe(first);
    expect(documents.list).toHaveLength(1);
  });

  it('starts a watcher for the opened path', async () => {
    files.set('C:/d/a.md', 'x');
    await documents.open('C:/d/a.md');
    expect(api.watch).toHaveBeenCalledWith('C:/d/a.md');
  });

  it('records the file in recents', async () => {
    files.set('C:/d/a.md', 'x');
    await documents.open('C:/d/a.md');
    expect(api.pushRecent).toHaveBeenCalledWith('C:/d/a.md');
  });

  it('propagates a read failure', async () => {
    await expect(documents.open('C:/d/missing.md')).rejects.toBeInstanceOf(ReaderError);
    expect(documents.list).toHaveLength(0);
  });

  it('disables the preview for a very large file', async () => {
    files.set('C:/d/big.md', 'x'.repeat(21 * 1024 * 1024));
    await documents.open('C:/d/big.md');
    expect(documents.activeMarkdown?.previewDisabled).toBe(true);
  });
});

describe('dirty tracking', () => {
  it('is clean right after opening', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    expect(documents.isDirty(id)).toBe(false);
  });

  it('becomes dirty after an edit', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setText(id, 'dos');
    expect(documents.isDirty(id)).toBe(true);
  });

  it('is clean again after saving', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setText(id, 'dos');
    await documents.save(id);
    expect(documents.isDirty(id)).toBe(false);
    expect(files.get('C:/d/a.md')).toBe('dos');
  });

  it('is clean again when the edit is undone back to the saved text', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setText(id, 'dos');
    documents.setText(id, 'uno');
    expect(documents.isDirty(id)).toBe(false);
  });

  it('skips the write when nothing changed', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    await expect(documents.save(id)).resolves.toBe('unchanged');
    expect(api.writeText).not.toHaveBeenCalled();
  });

  it('lists every dirty document', async () => {
    files.set('C:/d/a.md', 'uno');
    files.set('C:/d/b.md', 'dos');
    const a = await documents.open('C:/d/a.md');
    await documents.open('C:/d/b.md');
    documents.setText(a, 'cambiado');
    expect(documents.dirtyDocuments).toHaveLength(1);
  });
});

describe('create and saveAs', () => {
  it('creates an untitled document with no path', () => {
    const id = documents.create();
    expect(documents.markdownById(id)?.path).toBeNull();
    expect(documents.markdownById(id)?.title).toBe('Sin título');
  });

  it('save on an untitled document reports that a path is needed', async () => {
    const id = documents.create();
    await expect(documents.save(id)).resolves.toBe('needs-path');
  });

  it('saveAs writes the file and adopts the new path and title', async () => {
    const id = documents.create();
    documents.setText(id, 'contenido');
    await documents.saveAs(id, 'C:/d/nuevo.md');
    expect(files.get('C:/d/nuevo.md')).toBe('contenido');
    expect(documents.markdownById(id)?.title).toBe('nuevo.md');
    expect(documents.isDirty(id)).toBe(false);
  });

  it('saveAs stops watching the previous path', async () => {
    files.set('C:/d/a.md', 'x');
    const id = await documents.open('C:/d/a.md');
    await documents.saveAs(id, 'C:/d/b.md');
    expect(api.unwatch).toHaveBeenCalledWith('C:/d/a.md');
  });
});

describe('close', () => {
  it('removes the document and stops watching', async () => {
    files.set('C:/d/a.md', 'x');
    const id = await documents.open('C:/d/a.md');
    documents.close(id);
    expect(documents.list).toHaveLength(0);
    expect(api.unwatch).toHaveBeenCalledWith('C:/d/a.md');
  });

  it('activates the neighbouring tab', async () => {
    files.set('C:/d/a.md', 'x');
    files.set('C:/d/b.md', 'y');
    const first = await documents.open('C:/d/a.md');
    const second = await documents.open('C:/d/b.md');
    documents.close(second);
    expect(documents.activeId).toBe(first);
  });

  it('leaves no active document when the last tab closes', async () => {
    files.set('C:/d/a.md', 'x');
    const id = await documents.open('C:/d/a.md');
    documents.close(id);
    expect(documents.activeId).toBeNull();
  });

  it('keeps the active tab when closing another one', async () => {
    files.set('C:/d/a.md', 'x');
    files.set('C:/d/b.md', 'y');
    const first = await documents.open('C:/d/a.md');
    const second = await documents.open('C:/d/b.md');
    documents.close(first);
    expect(documents.activeId).toBe(second);
  });
});

describe('external changes', () => {
  it('reloads silently when the document is clean', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    files.set('C:/d/a.md', 'externo');
    await documents.markExternalChange(id, 'modified');
    expect(documents.markdownById(id)?.text).toBe('externo');
    expect(documents.markdownById(id)?.externalChange).toBe('none');
  });

  it('flags the conflict instead of reloading when the document is dirty', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setText(id, 'mío');
    files.set('C:/d/a.md', 'externo');
    await documents.markExternalChange(id, 'modified');
    expect(documents.markdownById(id)?.text).toBe('mío');
    expect(documents.markdownById(id)?.externalChange).toBe('modified');
  });

  it('detaches the document when the file is removed', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    files.delete('C:/d/a.md');
    await documents.markExternalChange(id, 'removed');
    expect(documents.markdownById(id)?.path).toBeNull();
    expect(documents.markdownById(id)?.text).toBe('uno');
    expect(documents.isDirty(id)).toBe(true);
  });

  it('reload replaces the text and clears the flag', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setText(id, 'mío');
    files.set('C:/d/a.md', 'externo');
    await documents.markExternalChange(id, 'modified');
    await documents.reload(id);
    expect(documents.markdownById(id)?.text).toBe('externo');
    expect(documents.markdownById(id)?.externalChange).toBe('none');
  });

  it('dismiss keeps my text and clears the flag', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setText(id, 'mío');
    await documents.markExternalChange(id, 'modified');
    documents.dismissExternalChange(id);
    expect(documents.markdownById(id)?.text).toBe('mío');
    expect(documents.markdownById(id)?.externalChange).toBe('none');
  });
});

describe('line endings', () => {
  it('changing the line ending marks the document dirty', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setLineEnding(id, 'crlf');
    expect(documents.isDirty(id)).toBe(true);
    expect(documents.markdownById(id)?.lineEnding).toBe('crlf');
  });

  it('saving writes with the chosen line ending', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setLineEnding(id, 'crlf');
    await documents.save(id);
    expect(api.writeText).toHaveBeenCalledWith('C:/d/a.md', 'uno', 'crlf');
  });
});

describe('pdf documents', () => {
  function info(pageCount = 3) {
    return {
      assetUrl: 'http://asset.localhost/C%3A/d/a.pdf',
      pageCount,
      annotations: [],
      encrypted: false,
    };
  }

  function highlight(page = 1, contents = '') {
    return {
      id: `h-${page}-${contents}`,
      page,
      kind: 'highlight' as const,
      color: '#ffd54f',
      opacity: 0.4,
      contents,
      author: 'yo',
      createdMs: 1,
      quads: [{ x1: 1, y1: 2, x2: 3, y2: 2, x3: 1, y3: 1, x4: 3, y4: 1 }],
      origin: 'reader' as const,
    };
  }

  it('opens a pdf as its own kind of document', () => {
    const id = documents.openPdf('C:/d/a.pdf', info());
    expect(documents.byId(id)?.kind).toBe('pdf');
    expect(documents.pdfById(id)?.pageCount).toBe(3);
  });

  it('uses the file name as the title', () => {
    documents.openPdf('C:/d/informe.pdf', info());
    expect(documents.active?.title).toBe('informe.pdf');
  });

  it('starts on the first page', () => {
    const id = documents.openPdf('C:/d/a.pdf', info());
    expect(documents.pdfById(id)?.page).toBe(1);
  });

  it('focuses the existing tab instead of opening it twice', () => {
    const first = documents.openPdf('C:/d/a.pdf', info());
    const second = documents.openPdf('C:/d/a.pdf', info());
    expect(second).toBe(first);
    expect(documents.list).toHaveLength(1);
  });

  it('is clean right after opening', () => {
    const id = documents.openPdf('C:/d/a.pdf', info());
    expect(documents.isDirty(id)).toBe(false);
  });

  it('becomes dirty when an annotation is added', () => {
    const id = documents.openPdf('C:/d/a.pdf', info());
    documents.setAnnotations(id, [highlight()]);
    expect(documents.isDirty(id)).toBe(true);
  });

  it('is clean again once the annotations are saved', () => {
    const id = documents.openPdf('C:/d/a.pdf', info());
    documents.setAnnotations(id, [highlight()]);
    documents.markPdfSaved(id, 42);
    expect(documents.isDirty(id)).toBe(false);
    expect(documents.pdfById(id)?.modifiedMs).toBe(42);
  });

  it('becomes dirty again after editing a saved annotation', () => {
    const id = documents.openPdf('C:/d/a.pdf', info());
    documents.setAnnotations(id, [highlight()]);
    documents.markPdfSaved(id, 1);
    documents.setAnnotations(id, [highlight(1, 'una nota')]);
    expect(documents.isDirty(id)).toBe(true);
  });

  it('is clean when an annotation is removed and put back', () => {
    const id = documents.openPdf('C:/d/a.pdf', info());
    documents.setAnnotations(id, [highlight()]);
    documents.markPdfSaved(id, 1);
    documents.setAnnotations(id, []);
    documents.setAnnotations(id, [highlight()]);
    expect(documents.isDirty(id)).toBe(false);
  });

  it('clamps the page to the document', () => {
    const id = documents.openPdf('C:/d/a.pdf', info(3));
    documents.setPage(id, 99);
    expect(documents.pdfById(id)?.page).toBe(3);
    documents.setPage(id, 0);
    expect(documents.pdfById(id)?.page).toBe(1);
  });

  it('opens a protected document read only', () => {
    const id = documents.openPdf('C:/d/a.pdf', { ...info(), encrypted: true });
    expect(documents.pdfById(id)?.readOnly).toBe(true);
  });

  it('ignores markdown operations', () => {
    const id = documents.openPdf('C:/d/a.pdf', info());
    documents.setText(id, 'no deberia entrar');
    expect(documents.markdownById(id)).toBeNull();
    expect(documents.isDirty(id)).toBe(false);
  });

  it('lists a dirty pdf alongside a dirty markdown', async () => {
    files.set('C:/d/a.md', 'uno');
    const md = await documents.open('C:/d/a.md');
    const pdf = documents.openPdf('C:/d/a.pdf', info());
    documents.setText(md, 'cambiado');
    documents.setAnnotations(pdf, [highlight()]);
    expect(documents.dirtyDocuments).toHaveLength(2);
  });

  it('closes like any other tab', () => {
    const id = documents.openPdf('C:/d/a.pdf', info());
    documents.close(id);
    expect(documents.list).toHaveLength(0);
  });
});

describe('kindForPath', () => {
  it('recognises a pdf', () => {
    expect(kindForPath('C:/d/a.pdf')).toBe('pdf');
  });

  it('recognises it whatever the case', () => {
    expect(kindForPath('C:/d/A.PDF')).toBe('pdf');
  });

  it('treats everything else as markdown', () => {
    expect(kindForPath('C:/d/a.md')).toBe('markdown');
    expect(kindForPath('C:/d/a.txt')).toBe('markdown');
  });
});
