import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import TextEditPopover from './TextEditPopover.svelte';

function props(overrides: Record<string, unknown> = {}) {
  return {
    x: 200,
    y: 300,
    value: 'Hola mundo',
    problem: '',
    busy: false,
    onchange: () => undefined,
    oncommit: () => undefined,
    oncancel: () => undefined,
    ...overrides,
  };
}

describe('TextEditPopover', () => {
  it('starts with the text that is there', () => {
    const { container } = render(TextEditPopover, props());
    expect((container.querySelector('.field') as HTMLInputElement).value).toBe('Hola mundo');
  });

  it('reports what is typed', () => {
    const onchange = vi.fn();
    const { container } = render(TextEditPopover, props({ onchange }));
    const field = container.querySelector('.field') as HTMLInputElement;
    field.value = 'Adios';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onchange).toHaveBeenCalledWith('Adios');
  });

  it('applies with enter', () => {
    const oncommit = vi.fn();
    const { container } = render(TextEditPopover, props({ oncommit }));
    container
      .querySelector('.field')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(oncommit).toHaveBeenCalled();
  });

  it('gives up with escape', () => {
    const oncancel = vi.fn();
    const { container } = render(TextEditPopover, props({ oncancel }));
    container
      .querySelector('.field')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(oncancel).toHaveBeenCalled();
  });

  it('says why it cannot be applied and does not let it', () => {
    const { container } = render(TextEditPopover, props({ problem: 'No cabe: sobran 12 puntos' }));
    expect(container.querySelector('.problem')?.textContent).toContain('No cabe');
    expect((container.querySelector('.primary') as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('.field')?.classList.contains('wrong')).toBe(true);
  });

  it('waits while it is checking', () => {
    const { container } = render(TextEditPopover, props({ busy: true }));
    expect((container.querySelector('.primary') as HTMLButtonElement).disabled).toBe(true);
  });
});
