import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { PageSize } from '$lib/pdf/document';
import { UNCHECKED, type FormField } from '$lib/pdf/forms/model';
import FormLayer from './FormLayer.svelte';

const A4: PageSize = { width: 600, height: 800, rotation: 0 };

function field(kind: FormField['kind'], extra: Partial<FormField> = {}): FormField {
  return {
    id: '1R',
    name: 'campo',
    kind,
    page: 1,
    rect: { x: 60, y: 700, width: 240, height: 22 },
    value: '',
    exportValue: '',
    options: [],
    readOnly: false,
    required: false,
    hidden: false,
    multiline: false,
    maxLength: 0,
    fontSize: 0,
    alignment: 0,
    ...extra,
  };
}

function props(overrides: Record<string, unknown> = {}) {
  return {
    size: A4,
    scale: 1,
    rotation: 0,
    fields: [] as FormField[],
    values: {} as Record<string, string>,
    onvalue: () => undefined,
    ...overrides,
  };
}

describe('FormLayer', () => {
  it('puts a text field where the pdf says', () => {
    const { container } = render(FormLayer, props({ fields: [field('text')] }));
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.style.left).toBe('60px');
    expect(input.style.top).toBe('78px');
    expect(input.style.width).toBe('240px');
  });

  it('follows the zoom', () => {
    const { container } = render(FormLayer, props({ fields: [field('text')], scale: 2 }));
    expect((container.querySelector('input') as HTMLInputElement).style.width).toBe('480px');
  });

  it('shows the value the field has', () => {
    const { container } = render(
      FormLayer,
      props({ fields: [field('text')], values: { campo: 'Esteban' } }),
    );
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('Esteban');
  });

  it('reports what is typed as it is typed', () => {
    const onvalue = vi.fn();
    const { container } = render(FormLayer, props({ fields: [field('text')], onvalue }));
    const input = container.querySelector('input') as HTMLInputElement;
    input.value = 'hola';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onvalue).toHaveBeenCalledWith('campo', 'hola');
  });

  it('uses a box of several lines when the field takes them', () => {
    const { container } = render(
      FormLayer,
      props({ fields: [field('text', { multiline: true })] }),
    );
    expect(container.querySelector('textarea')).not.toBeNull();
  });

  it('does not let a read only field be changed', () => {
    const { container } = render(
      FormLayer,
      props({ fields: [field('text', { readOnly: true })] }),
    );
    expect((container.querySelector('input') as HTMLInputElement).readOnly).toBe(true);
  });

  it('ticks a checkbox when it is pressed', () => {
    const onvalue = vi.fn();
    const box = field('checkbox', { exportValue: 'Si' });
    const { container } = render(
      FormLayer,
      props({ fields: [box], values: { campo: UNCHECKED }, onvalue }),
    );
    (container.querySelector('.tick') as HTMLButtonElement).click();
    expect(onvalue).toHaveBeenCalledWith('campo', 'Si');
  });

  it('unticks it when it was on', () => {
    const onvalue = vi.fn();
    const box = field('checkbox', { exportValue: 'Si' });
    const { container } = render(
      FormLayer,
      props({ fields: [box], values: { campo: 'Si' }, onvalue }),
    );
    (container.querySelector('.tick') as HTMLButtonElement).click();
    expect(onvalue).toHaveBeenCalledWith('campo', UNCHECKED);
  });

  it('chooses the radio button that was pressed', () => {
    const onvalue = vi.fn();
    const morning = field('radio', { id: '1R', exportValue: 'manana' });
    const evening = field('radio', { id: '2R', exportValue: 'tarde' });
    const { container } = render(
      FormLayer,
      props({ fields: [morning, evening], values: { campo: 'manana' }, onvalue }),
    );
    (container.querySelectorAll('.tick')[1] as HTMLButtonElement).click();
    expect(onvalue).toHaveBeenCalledWith('campo', 'tarde');
  });

  it('marks the radio button that is on', () => {
    const morning = field('radio', { id: '1R', exportValue: 'manana' });
    const evening = field('radio', { id: '2R', exportValue: 'tarde' });
    const { container } = render(
      FormLayer,
      props({ fields: [morning, evening], values: { campo: 'tarde' } }),
    );
    const ticks = container.querySelectorAll('.tick');
    expect(ticks[0]?.getAttribute('aria-checked')).toBe('false');
    expect(ticks[1]?.getAttribute('aria-checked')).toBe('true');
  });

  it('offers the options of a list', () => {
    const list = field('choice', {
      options: [
        { value: 'BOG', label: 'Bogota' },
        { value: 'MDE', label: 'Medellin' },
      ],
    });
    const { container } = render(FormLayer, props({ fields: [list] }));
    expect(container.querySelectorAll('option')).toHaveLength(3);
  });

  it('shows a signature field without letting it be typed into', () => {
    const { container } = render(FormLayer, props({ fields: [field('signature')] }));
    expect(container.querySelector('.signature')).not.toBeNull();
    expect(container.querySelector('input')).toBeNull();
  });

  it('draws nothing for a page with no fields', () => {
    const { container } = render(FormLayer, props());
    expect(container.querySelectorAll('.field')).toHaveLength(0);
  });
});
