import { describe, expect, it, vi } from 'vitest';

const openExternal = vi.fn(async () => undefined);

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => `http://asset.localhost/${encodeURIComponent(p)}`,
}));

vi.mock('$lib/fs/api', () => ({ openExternal }));

const { handlePreviewClick, rewriteAssets } = await import('./links');

function root(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.append(el);
  return el;
}

describe('rewriteAssets', () => {
  it('resolves a relative image against the document folder', () => {
    const el = root('<img src="img/a.png">');
    rewriteAssets(el, 'C:/docs/nota.md');
    expect(el.querySelector('img')?.getAttribute('src')).toContain(
      encodeURIComponent('C:/docs/img/a.png'),
    );
  });

  it('dice en que carpetas estan las imagenes, para pedir permiso', () => {
    const el = root('<img src="../fotos/a.png"><img src="b.png">');
    expect(rewriteAssets(el, 'C:/proyecto/docs/nota.md')).toEqual([
      'C:/proyecto/fotos',
      'C:/proyecto/docs',
    ]);
  });

  it('no pide carpetas para lo que no viene del disco', () => {
    const el = root('<img src="https://x.com/a.png"><img src="data:image/png;base64,AA">');
    expect(rewriteAssets(el, 'C:/docs/nota.md')).toEqual([]);
  });

  it('leaves an http image untouched', () => {
    const el = root('<img src="https://x.com/a.png">');
    rewriteAssets(el, 'C:/docs/nota.md');
    expect(el.querySelector('img')?.getAttribute('src')).toBe('https://x.com/a.png');
  });

  it('leaves a data uri untouched', () => {
    const el = root('<img src="data:image/png;base64,AAA">');
    rewriteAssets(el, 'C:/docs/nota.md');
    expect(el.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAA');
  });

  it('does nothing for an unsaved document', () => {
    const el = root('<img src="img/a.png">');
    rewriteAssets(el, null);
    expect(el.querySelector('img')?.getAttribute('src')).toBe('img/a.png');
  });

  it('is idempotent', () => {
    const el = root('<img src="img/a.png">');
    rewriteAssets(el, 'C:/docs/nota.md');
    const first = el.querySelector('img')?.getAttribute('src');
    rewriteAssets(el, 'C:/docs/nota.md');
    expect(el.querySelector('img')?.getAttribute('src')).toBe(first);
  });
});

describe('handlePreviewClick', () => {
  it('opens a relative markdown link as a document', () => {
    const el = root('<a href="otro.md">x</a>');
    const openDoc = vi.fn();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.querySelector('a')!.dispatchEvent(event);
    handlePreviewClick(event, 'C:/docs/nota.md', openDoc);
    expect(openDoc).toHaveBeenCalledWith('C:/docs/otro.md');
    expect(event.defaultPrevented).toBe(true);
  });

  it('sends an external link to the system browser', () => {
    openExternal.mockClear();
    const el = root('<a href="https://a.com">x</a>');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.querySelector('a')!.dispatchEvent(event);
    handlePreviewClick(event, 'C:/docs/nota.md', vi.fn());
    expect(openExternal).toHaveBeenCalledWith('https://a.com');
  });

  it('ignores a click that is not on a link', () => {
    const el = root('<p>texto</p>');
    const openDoc = vi.fn();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.querySelector('p')!.dispatchEvent(event);
    handlePreviewClick(event, 'C:/docs/nota.md', openDoc);
    expect(openDoc).not.toHaveBeenCalled();
  });

  it('scrolls to an anchor without opening a document', () => {
    const el = root('<h2 id="seccion">s</h2><a href="#seccion">x</a>');
    const openDoc = vi.fn();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.querySelector('a')!.dispatchEvent(event);
    handlePreviewClick(event, 'C:/docs/nota.md', openDoc);
    expect(openDoc).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not open a non-markdown relative link as a document', () => {
    const el = root('<a href="hoja.xlsx">x</a>');
    const openDoc = vi.fn();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.querySelector('a')!.dispatchEvent(event);
    handlePreviewClick(event, 'C:/docs/nota.md', openDoc);
    expect(openDoc).not.toHaveBeenCalled();
  });
});
