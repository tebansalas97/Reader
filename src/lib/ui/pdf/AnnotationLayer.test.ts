import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { rectToQuad } from '$lib/pdf/annotations/geometry';
import type { Annotation, AnnotationKind } from '$lib/pdf/annotations/model';
import type { PageSize } from '$lib/pdf/document';
import AnnotationLayer from './AnnotationLayer.svelte';

const A4: PageSize = { width: 600, height: 800, rotation: 0 };

function annotation(kind: AnnotationKind, extra: Partial<Annotation> = {}): Annotation {
  return {
    id: 'a1',
    page: 1,
    kind,
    color: '#ffd400',
    opacity: 0.4,
    contents: '',
    author: '',
    createdMs: 0,
    origin: 'file',
    ref: '12R',
    ...extra,
  };
}

const HIGHLIGHT = annotation('highlight', {
  quads: [rectToQuad({ x: 10, y: 700, width: 100, height: 12 })],
});

function props(overrides: Record<string, unknown> = {}) {
  return {
    page: 1,
    size: A4,
    scale: 1,
    rotation: 0,
    annotations: [] as Annotation[],
    tool: 'none' as const,
    color: '#ff0000',
    author: 'Esteban',
    selectedId: null,
    oncreate: () => undefined,
    onselect: () => undefined,
    ...overrides,
  };
}

function point(type: string, x: number, y: number): Event {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 });
  return event;
}

describe('AnnotationLayer', () => {
  it('paints the annotations of the page', () => {
    const { container } = render(AnnotationLayer, props({ annotations: [HIGHLIGHT] }));
    const rect = container.querySelector('.mark rect') as SVGRectElement;
    expect(rect.getAttribute('fill')).toBe('#ffd400');
    expect(rect.getAttribute('width')).toBe('100');
  });

  it('paints a drawing as a line', () => {
    const ink = annotation('ink', {
      ink: [
        [
          { x: 10, y: 700 },
          { x: 20, y: 690 },
        ],
      ],
    });
    const { container } = render(AnnotationLayer, props({ annotations: [ink] }));
    expect(container.querySelector('.mark polyline')).not.toBeNull();
  });

  it('lets the text be selected when no tool is on', () => {
    const { container } = render(AnnotationLayer, props());
    expect(container.querySelector('svg')?.classList.contains('drawing')).toBe(false);
  });

  it('takes the pointer when a tool is on', () => {
    const { container } = render(AnnotationLayer, props({ tool: 'rect' }));
    expect(container.querySelector('svg')?.classList.contains('drawing')).toBe(true);
  });

  it('lets an annotation be clicked when no tool is on', () => {
    const onselect = vi.fn();
    const { container } = render(
      AnnotationLayer,
      props({ annotations: [HIGHLIGHT], onselect }),
    );
    container.querySelector('.hit')?.dispatchEvent(point('pointerdown', 20, 95));
    expect(onselect).toHaveBeenCalledWith('a1');
  });

  it('does not select while a tool is on', () => {
    const onselect = vi.fn();
    const { container } = render(
      AnnotationLayer,
      props({ annotations: [HIGHLIGHT], onselect, tool: 'ink' }),
    );
    container.querySelector('.hit')?.dispatchEvent(point('pointerdown', 20, 95));
    expect(onselect).not.toHaveBeenCalled();
  });

  it('marks the selected annotation', () => {
    const { container } = render(
      AnnotationLayer,
      props({ annotations: [HIGHLIGHT], selectedId: 'a1' }),
    );
    expect(container.querySelector('.hit.selected')).not.toBeNull();
  });

  it('draws a rectangle from a drag, in page coordinates', () => {
    const oncreate = vi.fn();
    const { container } = render(AnnotationLayer, props({ tool: 'rect', oncreate }));
    const svg = container.querySelector('svg')!;
    svg.dispatchEvent(point('pointerdown', 10, 10));
    svg.dispatchEvent(point('pointermove', 110, 60));
    svg.dispatchEvent(point('pointerup', 110, 60));

    expect(oncreate).toHaveBeenCalledTimes(1);
    const made = oncreate.mock.calls[0]![0] as Annotation;
    expect(made.kind).toBe('rect');
    expect(made.origin).toBe('reader');
    expect(made.color).toBe('#ff0000');
    expect(made.author).toBe('Esteban');
    expect(made.rect).toEqual({ x: 10, y: 740, width: 100, height: 50 });
  });

  it('ignores a drag too small to be meant', () => {
    const oncreate = vi.fn();
    const { container } = render(AnnotationLayer, props({ tool: 'rect', oncreate }));
    const svg = container.querySelector('svg')!;
    svg.dispatchEvent(point('pointerdown', 10, 10));
    svg.dispatchEvent(point('pointermove', 12, 12));
    svg.dispatchEvent(point('pointerup', 12, 12));
    expect(oncreate).not.toHaveBeenCalled();
  });

  it('drops a note where it was clicked', () => {
    const oncreate = vi.fn();
    const { container } = render(AnnotationLayer, props({ tool: 'note', oncreate }));
    container.querySelector('svg')!.dispatchEvent(point('pointerdown', 30, 100));

    const made = oncreate.mock.calls[0]![0] as Annotation;
    expect(made.kind).toBe('note');
    expect(made.rect?.x).toBe(30);
    expect(made.rect?.y).toBe(800 - 100 - 22);
  });

  it('draws a stroke with the pen', () => {
    const oncreate = vi.fn();
    const { container } = render(AnnotationLayer, props({ tool: 'ink', oncreate }));
    const svg = container.querySelector('svg')!;
    svg.dispatchEvent(point('pointerdown', 10, 10));
    svg.dispatchEvent(point('pointermove', 40, 30));
    svg.dispatchEvent(point('pointerup', 40, 30));

    const made = oncreate.mock.calls[0]![0] as Annotation;
    expect(made.kind).toBe('ink');
    expect(made.ink?.[0]).toEqual([
      { x: 10, y: 790 },
      { x: 40, y: 770 },
    ]);
  });

  it('turns what it draws when the page is turned', () => {
    const oncreate = vi.fn();
    const { container } = render(
      AnnotationLayer,
      props({ tool: 'rect', rotation: 90, oncreate }),
    );
    const svg = container.querySelector('svg')!;
    svg.dispatchEvent(point('pointerdown', 100, 10));
    svg.dispatchEvent(point('pointermove', 160, 110));
    svg.dispatchEvent(point('pointerup', 160, 110));

    const made = oncreate.mock.calls[0]![0] as Annotation;
    expect(made.rect).toEqual({ x: 10, y: 100, width: 100, height: 60 });
  });
});
