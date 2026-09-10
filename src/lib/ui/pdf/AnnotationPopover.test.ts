import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { rectToQuad } from '$lib/pdf/annotations/geometry';
import type { Annotation } from '$lib/pdf/annotations/model';
import AnnotationPopover from './AnnotationPopover.svelte';

const ANNOTATION: Annotation = {
  id: 'a1',
  page: 1,
  kind: 'highlight',
  color: '#ffd400',
  opacity: 0.4,
  contents: '',
  author: '',
  createdMs: 0,
  origin: 'reader',
  quads: [rectToQuad({ x: 10, y: 700, width: 100, height: 12 })],
};

function props(overrides: Record<string, unknown> = {}) {
  return {
    annotation: ANNOTATION,
    x: 100,
    y: 100,
    onchange: () => undefined,
    ondelete: () => undefined,
    onclose: () => undefined,
    ...overrides,
  };
}

describe('AnnotationPopover', () => {
  it('keeps the comment as it is typed, without waiting for a click elsewhere', async () => {
    const onchange = vi.fn();
    const { container } = render(AnnotationPopover, props({ onchange }));
    const note = container.querySelector('textarea') as HTMLTextAreaElement;
    note.value = 'una nota';
    note.dispatchEvent(new Event('input', { bubbles: true }));

    expect(onchange).toHaveBeenCalledTimes(1);
    expect((onchange.mock.calls[0]![0] as Annotation).contents).toBe('una nota');
  });

  it('does not report a comment that did not change', () => {
    const onchange = vi.fn();
    const { container } = render(
      AnnotationPopover,
      props({ annotation: { ...ANNOTATION, contents: 'igual' }, onchange }),
    );
    const note = container.querySelector('textarea') as HTMLTextAreaElement;
    note.value = 'igual';
    note.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onchange).not.toHaveBeenCalled();
  });

  it('changes the colour', () => {
    const onchange = vi.fn();
    const { container } = render(AnnotationPopover, props({ onchange }));
    const swatches = container.querySelectorAll('.swatch');
    (swatches[2] as HTMLButtonElement).click();
    expect((onchange.mock.calls[0]![0] as Annotation).color).not.toBe('#ffd400');
  });

  it('marks the colour it already has', () => {
    const { container } = render(AnnotationPopover, props());
    expect(container.querySelector('.swatch.on')?.getAttribute('aria-label')).toBe('#ffd400');
  });

  it('deletes the annotation', () => {
    const ondelete = vi.fn();
    const { container } = render(AnnotationPopover, props({ ondelete }));
    (container.querySelector('.delete') as HTMLButtonElement).click();
    expect(ondelete).toHaveBeenCalledWith('a1');
  });

  it('closes with escape', () => {
    const onclose = vi.fn();
    const { container } = render(AnnotationPopover, props({ onclose }));
    container
      .querySelector('.popover')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onclose).toHaveBeenCalled();
  });

  it('deja comentar una imagen que ya estaba en el archivo', () => {
    const stamp: Annotation = { ...ANNOTATION, kind: 'stamp', origin: 'file', ref: '9R' };
    const { container } = render(AnnotationPopover, props({ annotation: stamp }));
    expect(container.querySelector('textarea')).not.toBeNull();
  });

  it('no ofrece colores para una imagen que ya estaba en el archivo', () => {
    const stamp: Annotation = { ...ANNOTATION, kind: 'stamp', origin: 'file', ref: '9R' };
    const { container } = render(AnnotationPopover, props({ annotation: stamp }));
    expect(container.querySelector('.swatch')).toBeNull();
  });

  it('ofrece el tamano de la letra solo al escribir texto', () => {
    const text: Annotation = {
      ...ANNOTATION,
      kind: 'freetext',
      quads: undefined,
      rect: { x: 10, y: 10, width: 100, height: 40 },
    };
    const { container } = render(AnnotationPopover, props({ annotation: text }));
    expect(container.querySelector('.size input')).not.toBeNull();
  });
});
