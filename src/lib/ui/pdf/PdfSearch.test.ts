import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import PdfSearch from './PdfSearch.svelte';

const PAGES = [
  { str: 'Linea uno de la pagina uno', hasEOL: true },
  { str: 'y algo mas', hasEOL: true },
];

function handle(pages = 2) {
  return {
    pageCount: pages,
    pageSizes: [],
    encrypted: false,
    outline: async () => [],
    page: async () => ({ getTextContent: async () => ({ items: PAGES }) }) as never,
    hideFromCanvas: () => undefined,
    showOnCanvas: () => undefined,
    destroy: async () => undefined,
  };
}

function props(overrides: Record<string, unknown> = {}) {
  return { handle: handle(), currentPage: 1, onselect: () => undefined, ...overrides };
}

async function type(container: HTMLElement, value: string): Promise<void> {
  const field = container.querySelector('.query') as HTMLInputElement;
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await tick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await tick();
}

describe('PdfSearch', () => {
  it('asks for at least two letters before searching', () => {
    const { container } = render(PdfSearch, props());
    expect(container.querySelector('.note')?.textContent).toContain('dos letras');
  });

  it('finds the text and says on how many pages', async () => {
    const { container } = render(PdfSearch, props());
    await type(container, 'pagina');
    expect(container.querySelector('.note')?.textContent).toContain('2 resultados');
    expect(container.querySelectorAll('.hit')).toHaveLength(2);
  });

  it('groups the hits by page', async () => {
    const { container } = render(PdfSearch, props());
    await type(container, 'pagina');
    expect(container.querySelectorAll('.page')).toHaveLength(2);
  });

  it('finds without minding the accents or the case', async () => {
    const { container } = render(PdfSearch, props());
    await type(container, 'LÍNEA');
    expect(container.querySelectorAll('.hit').length).toBeGreaterThan(0);
  });

  it('says when there is nothing', async () => {
    const { container } = render(PdfSearch, props());
    await type(container, 'zzzz');
    expect(container.querySelector('.note')?.textContent).toContain('no contiene');
  });

  it('goes to the page and points at the piece of text', async () => {
    const onselect = vi.fn();
    const { container } = render(PdfSearch, props({ onselect }));
    await type(container, 'algo');
    (container.querySelector('.hit') as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onselect).toHaveBeenCalledWith(1, [1]);
  });

  it('marks the page being read', async () => {
    const { container } = render(PdfSearch, props({ currentPage: 2 }));
    await type(container, 'pagina');
    expect(container.querySelectorAll('.page.here')).toHaveLength(1);
  });
});
