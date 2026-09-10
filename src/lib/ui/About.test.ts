import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import About from './About.svelte';

vi.mock('$lib/fs/api', () => ({ openExternal: vi.fn(async () => undefined) }));

function props(overrides: Record<string, unknown> = {}) {
  return { version: '0.2.0', onclose: () => undefined, ...overrides };
}

describe('About', () => {
  it('says which version is running', () => {
    const { container } = render(About, props());
    expect(container.querySelector('h2')?.textContent).toContain('0.2.0');
  });

  it('names the author', () => {
    const { container } = render(About, props());
    expect(container.querySelector('.author')?.textContent).toContain('Esteban D. Salas Herrera');
  });

  it('says the licence and how to give credit', () => {
    const { container } = render(About, props());
    expect(container.querySelector('.licence')?.textContent).toContain('Apache License 2.0');
    expect(container.querySelector('.credit')?.textContent).toContain('NOTICE');
  });

  it('lists the third-party components with their licence', () => {
    const { container } = render(About, props());
    const items = [...container.querySelectorAll('details li')].map((li) => li.textContent);
    expect(items.some((text) => text?.includes('pdf.js') && text.includes('Apache-2.0'))).toBe(true);
    expect(items.some((text) => text?.includes('dictionary-es') && text.includes('MPL-1.1'))).toBe(
      true,
    );
  });

  it('closes when asked', () => {
    const onclose = vi.fn();
    const { container } = render(About, props({ onclose }));
    (container.querySelector('.text') as HTMLButtonElement).click();
    expect(onclose).toHaveBeenCalled();
  });

  it('closes when the backdrop is pressed', () => {
    const onclose = vi.fn();
    const { container } = render(About, props({ onclose }));
    (container.querySelector('.backdrop') as HTMLElement).click();
    expect(onclose).toHaveBeenCalled();
  });
});
