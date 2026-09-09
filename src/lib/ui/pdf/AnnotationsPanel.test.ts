import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { rectToQuad } from '$lib/pdf/annotations/geometry';
import { initialPlan } from '$lib/pdf/pages';
import type { Annotation, AnnotationKind } from '$lib/pdf/annotations/model';
import AnnotationsPanel from './AnnotationsPanel.svelte';

function annotation(kind: AnnotationKind, extra: Partial<Annotation> = {}): Annotation {
  return {
    id: 'a1',
    page: 1,
    kind,
    color: '#ffd400',
    opacity: 1,
    contents: '',
    author: '',
    createdMs: 0,
    origin: 'reader',
    ...extra,
  };
}

const QUADS = [rectToQuad({ x: 60, y: 668, width: 200, height: 13 })];

function props(overrides: Record<string, unknown> = {}) {
  return {
    annotations: [] as Annotation[],
    plan: initialPlan(6),
    handle: null,
    selectedId: null,
    onselect: () => undefined,
    ondelete: () => undefined,
    ...overrides,
  };
}

const PAGE_TEXT = {
  items: [{ str: 'Linea uno de la pagina', transform: [11, 0, 0, 11, 60, 670], width: 200 }],
};

function fakeHandle() {
  return {
    pageCount: 1,
    pageSizes: [],
    encrypted: false,
    outline: async () => [],
    page: async () => ({ getTextContent: async () => PAGE_TEXT }) as never,
    hideFromCanvas: () => undefined,
    destroy: async () => undefined,
  };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('AnnotationsPanel', () => {
  it('says when there is nothing to list', () => {
    const { container } = render(AnnotationsPanel, props());
    expect(container.querySelector('.empty')).not.toBeNull();
  });

  it('lists an annotation under its kind, with the page it is on', () => {
    const { container } = render(
      AnnotationsPanel,
      props({ annotations: [annotation('note', { contents: 'recordar esto', page: 3 })] }),
    );
    expect(container.querySelector('.page')?.textContent).toContain('Nota');
    expect(container.querySelector('.text')?.textContent?.trim()).toBe('recordar esto');
    expect(container.querySelector('.at')?.textContent).toBe('3');
  });

  it('puts each kind in its own group', () => {
    const { container } = render(
      AnnotationsPanel,
      props({
        annotations: [
          annotation('strikeout', { id: 's1', page: 2, quads: QUADS }),
          annotation('note', { id: 'n1', page: 1, contents: 'uno' }),
          annotation('strikeout', { id: 's2', page: 1, quads: QUADS }),
        ],
      }),
    );
    const headings = [...container.querySelectorAll('.page')].map((p) => p.textContent?.trim());
    expect(headings).toHaveLength(2);
    expect(headings[0]).toContain('Tachar');
    expect(headings[0]).toContain('2');
    expect(container.querySelectorAll('.group')[0]?.querySelectorAll('.mark')).toHaveLength(2);
  });

  it('keeps the annotations of one kind together', () => {
    const { container } = render(
      AnnotationsPanel,
      props({
        annotations: [
          annotation('note', { id: 'a', rect: { x: 0, y: 700, width: 22, height: 22 } }),
          annotation('note', { id: 'b', rect: { x: 0, y: 600, width: 22, height: 22 } }),
        ],
      }),
    );
    expect(container.querySelectorAll('.group')).toHaveLength(1);
    expect(container.querySelectorAll('.mark')).toHaveLength(2);
  });

  it('names an annotation with no comment after its kind', () => {
    const { container } = render(
      AnnotationsPanel,
      props({ annotations: [annotation('ink', { ink: [[{ x: 1, y: 1 }]] })] }),
    );
    expect(container.querySelector('.text')?.textContent).toBe('Dibujar');
  });

  it('shows the text under a highlight once the page is read', async () => {
    const { container } = render(
      AnnotationsPanel,
      props({ annotations: [annotation('highlight', { quads: QUADS })], handle: fakeHandle() }),
    );
    await settle();
    await settle();
    expect(container.querySelector('.text')?.textContent).toBe('Linea uno de la pagina');
  });

  it('goes to the annotation when its row is clicked', async () => {
    const onselect = vi.fn();
    const { container } = render(
      AnnotationsPanel,
      props({ annotations: [annotation('note', { page: 5 })], onselect }),
    );
    (container.querySelector('.go') as HTMLButtonElement).click();
    expect(onselect).toHaveBeenCalledWith('a1', 5);
  });

  it('shows where its page sits now, not its page in the file', () => {
    const plan = [
      { source: 3, rotation: 0 as const },
      { source: 1, rotation: 0 as const },
    ];
    const { container } = render(
      AnnotationsPanel,
      props({ annotations: [annotation('note', { page: 3, contents: 'la tercera' })], plan }),
    );
    expect(container.querySelector('.at')?.textContent).toBe('1');
  });

  it('leaves out an annotation whose page is about to go', () => {
    const plan = [{ source: 2, rotation: 0 as const }];
    const { container } = render(
      AnnotationsPanel,
      props({ annotations: [annotation('note', { page: 1 })], plan }),
    );
    expect(container.querySelector('.empty')).not.toBeNull();
  });

  it('deletes from the list', () => {
    const ondelete = vi.fn();
    const { container } = render(
      AnnotationsPanel,
      props({ annotations: [annotation('note')], ondelete }),
    );
    (container.querySelector('.remove') as HTMLButtonElement).click();
    expect(ondelete).toHaveBeenCalledWith('a1');
  });

  it('marks the selected one', () => {
    const { container } = render(
      AnnotationsPanel,
      props({ annotations: [annotation('note')], selectedId: 'a1' }),
    );
    expect(container.querySelector('.mark.on')).not.toBeNull();
  });
});
