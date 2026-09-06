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

const { documents } = await import('./documents.svelte');
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
    expect(documents.active?.text).toBe('# hola');
  });

  it('uses the file name as the title', async () => {
    files.set('C:/d/a.md', '');
    await documents.open('C:/d/a.md');
    expect(documents.active?.title).toBe('a.md');
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
    expect(documents.active?.previewDisabled).toBe(true);
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
    expect(documents.byId(id)?.path).toBeNull();
    expect(documents.byId(id)?.title).toBe('Sin título');
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
    expect(documents.byId(id)?.title).toBe('nuevo.md');
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
    expect(documents.byId(id)?.text).toBe('externo');
    expect(documents.byId(id)?.externalChange).toBe('none');
  });

  it('flags the conflict instead of reloading when the document is dirty', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setText(id, 'mío');
    files.set('C:/d/a.md', 'externo');
    await documents.markExternalChange(id, 'modified');
    expect(documents.byId(id)?.text).toBe('mío');
    expect(documents.byId(id)?.externalChange).toBe('modified');
  });

  it('detaches the document when the file is removed', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    files.delete('C:/d/a.md');
    await documents.markExternalChange(id, 'removed');
    expect(documents.byId(id)?.path).toBeNull();
    expect(documents.byId(id)?.text).toBe('uno');
    expect(documents.isDirty(id)).toBe(true);
  });

  it('reload replaces the text and clears the flag', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setText(id, 'mío');
    files.set('C:/d/a.md', 'externo');
    await documents.markExternalChange(id, 'modified');
    await documents.reload(id);
    expect(documents.byId(id)?.text).toBe('externo');
    expect(documents.byId(id)?.externalChange).toBe('none');
  });

  it('dismiss keeps my text and clears the flag', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setText(id, 'mío');
    await documents.markExternalChange(id, 'modified');
    documents.dismissExternalChange(id);
    expect(documents.byId(id)?.text).toBe('mío');
    expect(documents.byId(id)?.externalChange).toBe('none');
  });
});

describe('line endings', () => {
  it('changing the line ending marks the document dirty', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setLineEnding(id, 'crlf');
    expect(documents.isDirty(id)).toBe(true);
    expect(documents.byId(id)?.lineEnding).toBe('crlf');
  });

  it('saving writes with the chosen line ending', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setLineEnding(id, 'crlf');
    await documents.save(id);
    expect(api.writeText).toHaveBeenCalledWith('C:/d/a.md', 'uno', 'crlf');
  });
});
