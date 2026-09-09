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
    const shape = container.querySelector('.mark polygon') as SVGPolygonElement;
    expect(shape.getAttribute('fill')).toBe('#ffd400');
    expect(shape.getAttribute('points')).toBe(
      '10.00,100.00 110.00,100.00 110.00,88.00 10.00,88.00',
    );
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

  it('frames the selected annotation with its handles', () => {
    const { container } = render(
      AnnotationLayer,
      props({ annotations: [HIGHLIGHT], selectedId: 'a1' }),
    );
    expect(container.querySelector('.frame .outline')).not.toBeNull();
    expect(container.querySelectorAll('.frame rect.handle')).toHaveLength(4);
    expect(container.querySelector('.frame circle.turn')).not.toBeNull();
  });

  it('offers no handles while a tool is on', () => {
    const { container } = render(
      AnnotationLayer,
      props({ annotations: [HIGHLIGHT], selectedId: 'a1', tool: 'ink' }),
    );
    expect(container.querySelector('.frame')).toBeNull();
  });

  it('does not offer to turn a rectangle', () => {
    const shape = annotation('rect', {
      id: 'r1',
      rect: { x: 10, y: 10, width: 100, height: 50 },
    });
    const { container } = render(
      AnnotationLayer,
      props({ annotations: [shape], selectedId: 'r1' }),
    );
    expect(container.querySelectorAll('.frame rect.handle')).toHaveLength(4);
    expect(container.querySelector('.frame circle.turn')).toBeNull();
  });

  it('offers no handles to resize a note', () => {
    const note = annotation('note', {
      id: 'n1',
      rect: { x: 10, y: 700, width: 22, height: 22 },
    });
    const { container } = render(
      AnnotationLayer,
      props({ annotations: [note], selectedId: 'n1' }),
    );
    expect(container.querySelectorAll('.frame rect.handle')).toHaveLength(0);
  });

  it('moves the selected annotation by dragging it', () => {
    const onchange = vi.fn();
    const { container } = render(
      AnnotationLayer,
      props({ annotations: [HIGHLIGHT], selectedId: 'a1', onchange }),
    );
    const hit = container.querySelector('.hit')!;
    hit.dispatchEvent(point('pointerdown', 50, 95));
    hit.dispatchEvent(point('pointermove', 70, 115));
    hit.dispatchEvent(point('pointerup', 70, 115));

    const moved = onchange.mock.calls[0]![0] as Annotation;
    expect(moved.id).toBe('a1');
    expect(moved.quads![0]!.x1).toBe(30);
    expect(moved.quads![0]!.y1).toBe(692);
  });

  it('does not report a move that went nowhere', () => {
    const onchange = vi.fn();
    const { container } = render(
      AnnotationLayer,
      props({ annotations: [HIGHLIGHT], selectedId: 'a1', onchange }),
    );
    const hit = container.querySelector('.hit')!;
    hit.dispatchEvent(point('pointerdown', 50, 95));
    hit.dispatchEvent(point('pointerup', 50, 95));
    expect(onchange).not.toHaveBeenCalled();
  });

  it('does not move an annotation that is not selected', () => {
    const onselect = vi.fn();
    const onchange = vi.fn();
    const { container } = render(
      AnnotationLayer,
      props({ annotations: [HIGHLIGHT], onselect, onchange }),
    );
    const hit = container.querySelector('.hit')!;
    hit.dispatchEvent(point('pointerdown', 50, 95));
    hit.dispatchEvent(point('pointermove', 70, 115));
    hit.dispatchEvent(point('pointerup', 70, 115));
    expect(onselect).toHaveBeenCalledWith('a1');
    expect(onchange).not.toHaveBeenCalled();
  });

  it('stretches the annotation by dragging a corner', () => {
    const onchange = vi.fn();
    const { container } = render(
      AnnotationLayer,
      props({ annotations: [HIGHLIGHT], selectedId: 'a1', onchange }),
    );
    const corner = container.querySelectorAll('.frame rect.handle')[2]!;
    corner.dispatchEvent(point('pointerdown', 110, 100));
    corner.dispatchEvent(point('pointermove', 210, 100));
    corner.dispatchEvent(point('pointerup', 210, 100));

    const scaled = onchange.mock.calls[0]![0] as Annotation;
    expect(scaled.quads![0]!.x2).toBeCloseTo(210, 5);
    expect(scaled.quads![0]!.y1).toBeCloseTo(712, 5);
  });

  it('turns the annotation by dragging the round handle', () => {
    const onchange = vi.fn();
    const { container } = render(
      AnnotationLayer,
      props({ annotations: [HIGHLIGHT], selectedId: 'a1', onchange }),
    );
    const turn = container.querySelector('.frame circle.turn')!;
    turn.dispatchEvent(point('pointerdown', 60, 70));
    turn.dispatchEvent(point('pointermove', 200, 94));
    turn.dispatchEvent(point('pointerup', 200, 94));

    const turned = onchange.mock.calls[0]![0] as Annotation;
    expect(turned.quads![0]!.y1).not.toBeCloseTo(turned.quads![0]!.y2, 3);
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
