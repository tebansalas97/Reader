import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { PageSize } from '$lib/pdf/document';
import type { TextEdit } from '$lib/pdf/edit/document';
import TextEditLayer from './TextEditLayer.svelte';

const A4: PageSize = { width: 600, height: 800, rotation: 0 };

function edit(overrides: Partial<TextEdit> = {}): TextEdit {
  return {
    id: 't1',
    page: 1,
    x: 60,
    y: 700,
    width: 200,
    height: 12,
    oldText: 'Hola mundo',
    newText: 'Adios mundo',
    ...overrides,
  };
}

function props(overrides: Record<string, unknown> = {}) {
  return {
    size: A4,
    scale: 1,
    rotation: 0,
    edits: [] as TextEdit[],
    onremove: () => undefined,
    ...overrides,
  };
}

describe('TextEditLayer', () => {
  it('draws nothing when there is nothing pending', () => {
    const { container } = render(TextEditLayer, props());
    expect(container.querySelectorAll('.edit')).toHaveLength(0);
  });

  it('covers the old text with the new one', () => {
    const { container } = render(TextEditLayer, props({ edits: [edit()] }));
    const box = container.querySelector('.edit') as HTMLElement;
    expect(box.textContent?.trim()).toBe('Adios mundo');
    expect(box.style.left).toBe('60px');
    expect(box.style.width).toBe('200px');
  });

  it('sits over the line of text it replaces', () => {
    const { container } = render(TextEditLayer, props({ edits: [edit()] }));
    const box = container.querySelector('.edit') as HTMLElement;
    expect(Number.parseFloat(box.style.top)).toBeCloseTo(800 - 700 - 12 * 0.94, 1);
  });

  it('follows the zoom', () => {
    const { container } = render(TextEditLayer, props({ edits: [edit()], scale: 2 }));
    expect((container.querySelector('.edit') as HTMLElement).style.width).toBe('400px');
  });

  it('keeps the old text as its tooltip', () => {
    const { container } = render(TextEditLayer, props({ edits: [edit()] }));
    expect(container.querySelector('.edit')?.getAttribute('title')).toBe('Hola mundo');
  });

  it('undoes the change when it is pressed', () => {
    const onremove = vi.fn();
    const { container } = render(TextEditLayer, props({ edits: [edit()], onremove }));
    (container.querySelector('.edit') as HTMLButtonElement).click();
    expect(onremove).toHaveBeenCalledWith('t1');
  });
});
