import { render } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReaderError } from '$lib/fs/api-types';

const files = new Map<string, string>();
const openExternal = vi.fn(async () => undefined);

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => `http://asset.localhost/${encodeURIComponent(p)}`,
}));

vi.mock('$lib/fs/api', () => ({
  readText: vi.fn(async (path: string) => {
    if (!files.has(path)) throw new ReaderError('NotFound', 'no existe', path);
    return { text: files.get(path)!, modifiedMs: 1, lineEnding: 'lf' as const };
  }),
  writeText: vi.fn(async () => 2),
  watch: vi.fn(async () => undefined),
  unwatch: vi.fn(async () => undefined),
  pushRecent: vi.fn(async () => []),
  getPrefs: vi.fn(async () => ({})),
  setPrefs: vi.fn(async () => undefined),
  openExternal,
}));

const { documents } = await import('$lib/state/documents.svelte');
const Preview = (await import('./Preview.svelte')).default;

const DOC = '# Titulo\n\nUn parrafo.\n\n```js\nconst a = 1;\n```\n';

function content(container: HTMLElement): HTMLElement {
  return container.querySelector('.content') as HTMLElement;
}

async function settle(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  await new Promise((resolve) => setTimeout(resolve, 30));
}

function click(el: Element, detail = 1): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, detail });
  el.dispatchEvent(event);
  return event;
}

beforeEach(async () => {
  files.clear();
  documents.reset();
  files.set('C:/d/a.md', DOC);
  await documents.open('C:/d/a.md');
  vi.clearAllMocks();
});

describe('Preview', () => {
  it('renders the document', async () => {
    const { container } = render(Preview, { docId: documents.activeId!, onopen: vi.fn() });
    await settle();
    expect(content(container).querySelector('h1')?.textContent).toContain('Titulo');
  });

  it('adds a copy button to code blocks', async () => {
    const { container } = render(Preview, { docId: documents.activeId!, onopen: vi.fn() });
    await settle();
    expect(content(container).querySelector('button.code-copy')).not.toBeNull();
  });

  it('copies the code and reports success', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const oncopy = vi.fn();
    const { container } = render(Preview, {
      docId: documents.activeId!,
      onopen: vi.fn(),
      oncopy,
    });
    await settle();
    click(content(container).querySelector('button.code-copy')!);
    await settle();
    expect(writeText).toHaveBeenCalledWith('const a = 1;');
    expect(oncopy).toHaveBeenCalledWith(true);
  });

  it('reports a failed copy instead of throwing', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(async () => {
          throw new Error('denegado');
        }),
      },
      configurable: true,
    });
    const oncopy = vi.fn();
    const { container } = render(Preview, {
      docId: documents.activeId!,
      onopen: vi.fn(),
      oncopy,
    });
    await settle();
    click(content(container).querySelector('button.code-copy')!);
    await settle();
    expect(oncopy).toHaveBeenCalledWith(false);
  });

  it('opens the diagram viewer when a rendered diagram is clicked', async () => {
    const ondiagram = vi.fn();
    const { container } = render(Preview, {
      docId: documents.activeId!,
      onopen: vi.fn(),
      ondiagram,
    });
    await settle();
    const node = content(container);
    node.innerHTML =
      '<pre class="mermaid" data-rendered="1" data-line="0"><svg><g id="n"></g></svg></pre>';
    click(node.querySelector('#n')!);
    expect(ondiagram).toHaveBeenCalledOnce();
    expect(ondiagram.mock.calls[0]?.[0]).toContain('<g');
  });

  it('does not open the viewer for a diagram that failed to render', async () => {
    const ondiagram = vi.fn();
    const { container } = render(Preview, {
      docId: documents.activeId!,
      onopen: vi.fn(),
      ondiagram,
    });
    await settle();
    const node = content(container);
    node.innerHTML = '<pre class="mermaid-error" data-line="0">roto</pre>';
    click(node.querySelector('pre')!);
    expect(ondiagram).not.toHaveBeenCalled();
  });

  it('reports the source line on a double click', async () => {
    const onpicksource = vi.fn();
    const { container } = render(Preview, {
      docId: documents.activeId!,
      onopen: vi.fn(),
      onpicksource,
    });
    await settle();
    const paragraph = content(container).querySelector('p');
    click(paragraph!, 2);
    expect(onpicksource).toHaveBeenCalledWith(2);
  });

  it('ignores a single click for the source jump', async () => {
    const onpicksource = vi.fn();
    const { container } = render(Preview, {
      docId: documents.activeId!,
      onopen: vi.fn(),
      onpicksource,
    });
    await settle();
    click(content(container).querySelector('p')!, 1);
    expect(onpicksource).not.toHaveBeenCalled();
  });

  it('highlights the active block', async () => {
    const { container } = render(Preview, {
      docId: documents.activeId!,
      onopen: vi.fn(),
      activeBlock: { start: 2, end: 2 },
    });
    await settle();
    expect(content(container).querySelector('.is-active-block')?.textContent).toContain(
      'Un parrafo',
    );
  });
});
