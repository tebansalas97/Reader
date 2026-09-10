import { render } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const renders: Array<{ scale: number; rotation: number }> = [];
const cancels = { count: 0 };

vi.mock('$lib/pdf/render', async () => {
  const actual = await vi.importActual<typeof import('$lib/pdf/render')>('$lib/pdf/render');
  return {
    ...actual,
    createPageRenderer: () => ({
      async render(_page: unknown, scale: number, rotation: number) {
        renders.push({ scale, rotation });
      },
      cancel() {
        cancels.count += 1;
      },
    }),
  };
});

const PdfPage = (await import('./PdfPage.svelte')).default;

const SIZE = { width: 600, height: 800, rotation: 0 };

function page(): { pageNumber: number; getTextContent: () => Promise<{ items: unknown[] }> } {
  return {
    pageNumber: 1,
    getTextContent: async () => ({ items: [] }),
  };
}

const stableGetPage = async () => page() as never;

function props(overrides: Record<string, unknown> = {}) {
  return {
    index: 0,
    page: 1,
    size: SIZE,
    scale: 1,
    rotation: 0,
    live: true,
    getPage: stableGetPage,
    ...overrides,
  };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  renders.length = 0;
  cancels.count = 0;
});

describe('PdfPage', () => {
  it('draws the page once when it becomes visible', async () => {
    render(PdfPage, props());
    await settle();
    expect(renders).toHaveLength(1);
  });

  it('draws again when the zoom changes, without remounting', async () => {
    const { container, rerender } = render(PdfPage, props());
    await settle();
    const before = container.querySelector('canvas');
    await rerender(props({ scale: 2 }));
    await settle();
    expect(container.querySelector('canvas')).toBe(before);
    expect(renders.map((r) => r.scale)).toEqual([1, 2]);
  });

  it('draws again when the page is rotated', async () => {
    const { rerender } = render(PdfPage, props());
    await settle();
    await rerender(props({ rotation: 90 }));
    await settle();
    expect(renders.map((r) => r.rotation)).toEqual([0, 90]);
  });

  it('draws with the zoom and the rotation it was given', async () => {
    render(PdfPage, props({ scale: 1.5, rotation: 180 }));
    await settle();
    expect(renders[0]).toEqual({ scale: 1.5, rotation: 180 });
  });

  it('draws a page that the file already had turned at its own rotation', async () => {
    render(PdfPage, props({ size: { width: 600, height: 800, rotation: 90 }, rotation: 90 }));
    await settle();
    expect(renders[0]?.rotation).toBe(180);
  });

  it('does not draw a page that is out of view', async () => {
    render(PdfPage, props({ live: false }));
    await settle();
    expect(renders).toHaveLength(0);
  });

  it('draws it when it comes into view', async () => {
    const { rerender } = render(PdfPage, props({ live: false }));
    await settle();
    await rerender(props({ live: true }));
    await settle();
    expect(renders).toHaveLength(1);
  });

  it('frees the canvas when the page leaves the view', async () => {
    const { container, rerender } = render(PdfPage, props());
    await settle();
    await rerender(props({ live: false }));
    await settle();
    expect(container.querySelector('canvas')?.width).toBe(0);
  });

  it('sizes the box from the zoom', async () => {
    const { container } = render(PdfPage, props({ scale: 2 }));
    await settle();
    const box = container.querySelector('.page') as HTMLElement;
    expect(box.style.width).toBe('1200px');
    expect(box.style.height).toBe('1600px');
  });

  it('swaps the sides of the box when the page is turned', async () => {
    const { container } = render(PdfPage, props({ rotation: 90 }));
    await settle();
    const box = container.querySelector('.page') as HTMLElement;
    expect(box.style.width).toBe('800px');
    expect(box.style.height).toBe('600px');
  });

  it('shows the page number until the page is drawn', () => {
    const { container } = render(PdfPage, props({ live: false }));
    expect(container.querySelector('.placeholder')?.textContent?.trim()).toBe('1');
  });

  it('hides the placeholder once the page is drawn', async () => {
    const { container } = render(PdfPage, props());
    await settle();
    expect(container.querySelector('.placeholder')).toBeNull();
  });

  it('reports a page that could not be drawn', async () => {
    const onfailed = vi.fn();
    render(
      PdfPage,
      props({
        index: 4,
        getPage: async () => {
          throw new Error('roto');
        },
        onfailed,
      }),
    );
    await settle();
    expect(onfailed).toHaveBeenCalledWith(4);
  });

  it('inverts the canvas in night mode', async () => {
    const { container } = render(PdfPage, props({ night: true }));
    await settle();
    expect(container.querySelector('canvas.night')).not.toBeNull();
  });

  it('leaves the canvas alone when night mode is off', async () => {
    const { container } = render(PdfPage, props());
    await settle();
    expect(container.querySelector('canvas.night')).toBeNull();
  });

  it('keeps showing the number of a page that failed', async () => {
    const { container } = render(
      PdfPage,
      props({
        getPage: async () => {
          throw new Error('roto');
        },
      }),
    );
    await settle();
    expect(container.querySelector('.placeholder')).not.toBeNull();
  });
});
