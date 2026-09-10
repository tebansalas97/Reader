import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import PrintDialog from './PrintDialog.svelte';

function props(overrides: Record<string, unknown> = {}) {
  return {
    pageCount: 10,
    onprint: () => undefined,
    oncancel: () => undefined,
    ...overrides,
  };
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('PrintDialog', () => {
  it('starts on the whole document', () => {
    const { container } = render(PrintDialog, props());
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(container.querySelector('.hint')?.textContent?.trim()).toContain('10');
  });

  it('starts on the pages already chosen', () => {
    const { container } = render(PrintDialog, props({ initial: '2-3' }));
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('2-3');
  });

  it('prints what was written', async () => {
    const onprint = vi.fn();
    const { container } = render(PrintDialog, props({ onprint }));
    type(container.querySelector('input') as HTMLInputElement, '2,4-5');
    await Promise.resolve();
    (container.querySelector('.primary') as HTMLButtonElement).click();
    expect(onprint).toHaveBeenCalledWith([2, 4, 5]);
  });

  it('refuses a range that covers nothing', async () => {
    const onprint = vi.fn();
    const { container } = render(PrintDialog, props({ onprint }));
    type(container.querySelector('input') as HTMLInputElement, '99');
    await Promise.resolve();
    const button = container.querySelector('.primary') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    button.click();
    expect(onprint).not.toHaveBeenCalled();
  });

  it('closes with Escape', () => {
    const oncancel = vi.fn();
    render(PrintDialog, props({ oncancel }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(oncancel).toHaveBeenCalled();
  });

  it('prints with Enter', () => {
    const onprint = vi.fn();
    render(PrintDialog, props({ pageCount: 2, onprint }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onprint).toHaveBeenCalledWith([1, 2]);
  });
});
