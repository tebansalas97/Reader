import { render } from '@testing-library/svelte';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initialPlan } from '$lib/pdf/pages';
import PdfThumbnails from './PdfThumbnails.svelte';

beforeAll(() => {
  class Observer {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(globalThis, 'IntersectionObserver', { value: Observer, writable: true });
});

const SIZE = { width: 600, height: 800, rotation: 0 };

function handle(pages = 4) {
  return {
    pageCount: pages,
    pageSizes: Array.from({ length: pages }, () => SIZE),
    encrypted: false,
    outline: async () => [],
    page: async () => ({}) as never,
    hideFromCanvas: () => undefined,
    showOnCanvas: () => undefined,
    destroy: async () => undefined,
  };
}

function props(overrides: Record<string, unknown> = {}) {
  return {
    handle: handle(),
    plan: initialPlan(4),
    currentPage: 1,
    selected: [] as number[],
    onselect: () => undefined,
    onselection: () => undefined,
    onmove: () => undefined,
    onturn: () => undefined,
    onremove: () => undefined,
    onextract: () => undefined,
    ...overrides,
  };
}

function pointer(type: string, x: number, y: number, extra: Record<string, unknown> = {}): Event {
  return new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0, ...extra });
}

function toolNamed(container: HTMLElement, label: string): HTMLButtonElement {
  return container.querySelector(`.tool[aria-label="${label}"]`) as HTMLButtonElement;
}

describe('PdfThumbnails', () => {
  it('shows one thumbnail per page of the plan', () => {
    const { container } = render(PdfThumbnails, props());
    expect(container.querySelectorAll('.thumb')).toHaveLength(4);
  });

  it('numbers them by their place in the document, not by their page in the file', () => {
    const plan = [
      { source: 3, rotation: 0 as const },
      { source: 1, rotation: 0 as const },
    ];
    const { container } = render(PdfThumbnails, props({ plan }));
    const labels = [...container.querySelectorAll('.thumb span')].map((s) => s.textContent);
    expect(labels).toEqual(['1', '2']);
  });

  it('marks the page being read', () => {
    const { container } = render(PdfThumbnails, props({ currentPage: 2 }));
    expect(container.querySelectorAll('.thumb')[1]?.classList.contains('active')).toBe(true);
  });

  it('selects a page and goes to it', () => {
    const onselection = vi.fn();
    const onselect = vi.fn();
    const { container } = render(PdfThumbnails, props({ onselection, onselect }));
    const thumb = container.querySelectorAll('.thumb')[2]!;
    thumb.dispatchEvent(pointer('pointerdown', 10, 10));
    thumb.dispatchEvent(pointer('pointerup', 10, 10));
    expect(onselection).toHaveBeenCalledWith([2]);
    expect(onselect).toHaveBeenCalledWith(3);
  });

  it('adds a page to the selection with control', () => {
    const onselection = vi.fn();
    const { container } = render(PdfThumbnails, props({ selected: [0], onselection }));
    const thumb = container.querySelectorAll('.thumb')[2]!;
    thumb.dispatchEvent(pointer('pointerdown', 10, 10, { ctrlKey: true }));
    thumb.dispatchEvent(pointer('pointerup', 10, 10, { ctrlKey: true }));
    expect(onselection).toHaveBeenCalledWith([0, 2]);
  });

  it('does not turn or remove anything with nothing selected', () => {
    const { container } = render(PdfThumbnails, props());
    expect(toolNamed(container, 'Girar la página a la izquierda').disabled).toBe(true);
    expect(toolNamed(container, 'Quitar del documento').disabled).toBe(true);
  });

  it('turns the selected pages', () => {
    const onturn = vi.fn();
    const { container } = render(PdfThumbnails, props({ selected: [1], onturn }));
    toolNamed(container, 'Girar la página a la derecha').click();
    expect(onturn).toHaveBeenCalledWith([1], 1);
  });

  it('removes the selected pages', () => {
    const onremove = vi.fn();
    const { container } = render(PdfThumbnails, props({ selected: [1], onremove }));
    toolNamed(container, 'Quitar del documento').click();
    expect(onremove).toHaveBeenCalledWith([1]);
  });

  it('refuses to remove every page', () => {
    const { container } = render(PdfThumbnails, props({ selected: [0, 1, 2, 3] }));
    expect(toolNamed(container, 'Quitar del documento').disabled).toBe(true);
  });

  it('extracts the selected pages', () => {
    const onextract = vi.fn();
    const { container } = render(PdfThumbnails, props({ selected: [0, 2], onextract }));
    toolNamed(container, 'Extraer a otro archivo').click();
    expect(onextract).toHaveBeenCalledWith([0, 2]);
  });

  it('says how many pages are selected', () => {
    const { container } = render(PdfThumbnails, props({ selected: [0, 2] }));
    expect(container.querySelector('.count')?.textContent).toContain('2');
  });

  it('moves a page when it is dragged onto another', () => {
    const onmove = vi.fn();
    const { container } = render(PdfThumbnails, props({ selected: [0], onmove }));
    const thumbs = container.querySelectorAll('.thumb');
    const first = thumbs[0]!;
    first.dispatchEvent(pointer('pointerdown', 10, 10));
    first.dispatchEvent(pointer('pointermove', 10, 200));
    first.dispatchEvent(pointer('pointerup', 10, 200));
    expect(onmove).toHaveBeenCalledTimes(1);
    expect(onmove.mock.calls[0]![0]).toEqual([0]);
  });

  it('does not move anything on a plain click', () => {
    const onmove = vi.fn();
    const { container } = render(PdfThumbnails, props({ onmove }));
    const thumb = container.querySelectorAll('.thumb')[1]!;
    thumb.dispatchEvent(pointer('pointerdown', 10, 10));
    thumb.dispatchEvent(pointer('pointermove', 11, 11));
    thumb.dispatchEvent(pointer('pointerup', 11, 11));
    expect(onmove).not.toHaveBeenCalled();
  });
});
