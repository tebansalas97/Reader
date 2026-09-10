import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { stamps, type StampItem } from '$lib/state/stamps.svelte';
import StampLibrary from './StampLibrary.svelte';

vi.mock('$lib/fs/api', () => ({
  getStamps: async () => [],
  setStamps: async () => undefined,
}));

beforeAll(() => {
  const fake = {
    font: '',
    fillStyle: '',
    textBaseline: '',
    measureText: () => ({ width: 220 }),
    fillText: () => undefined,
    clearRect: () => undefined,
    drawImage: () => undefined,
  };
  HTMLCanvasElement.prototype.getContext = (() => fake) as never;
  HTMLCanvasElement.prototype.toDataURL = (() => 'data:image/png;base64,AAAA') as never;
});

function item(overrides: Partial<StampItem> = {}): StampItem {
  return {
    id: 's1',
    name: 'Mi firma',
    kind: 'draw',
    strokes: '[[[0,0],[1,1]]]',
    image: '',
    ratio: 0.4,
    ...overrides,
  };
}

function props(overrides: Record<string, unknown> = {}) {
  return {
    onplace: () => undefined,
    onimport: () => undefined,
    onclose: () => undefined,
    ...overrides,
  };
}

beforeEach(() => {
  stamps.items = [];
  stamps.active = null;
});

describe('StampLibrary', () => {
  it('says when the catalogue is empty', () => {
    const { container } = render(StampLibrary, props());
    expect(container.querySelector('.empty')).not.toBeNull();
  });

  it('lists what is in the catalogue', () => {
    stamps.items = [item(), item({ id: 's2', name: 'Sello', kind: 'image', image: 'data:image/png;base64,AA' })];
    const { container } = render(StampLibrary, props());
    expect(container.querySelectorAll('.item')).toHaveLength(2);
    expect(container.querySelector('.thumb img')).not.toBeNull();
    expect(container.querySelector('.thumb svg')).not.toBeNull();
  });

  it('places the one that is pressed', () => {
    const onplace = vi.fn();
    stamps.items = [item()];
    const { container } = render(StampLibrary, props({ onplace }));
    (container.querySelector('.use') as HTMLButtonElement).click();
    expect(onplace).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
  });

  it('renames an entry', () => {
    stamps.items = [item()];
    const { container } = render(StampLibrary, props());
    const name = container.querySelector('.name') as HTMLInputElement;
    name.value = 'Firma nueva';
    name.dispatchEvent(new Event('change', { bubbles: true }));
    expect(stamps.items[0]?.name).toBe('Firma nueva');
  });

  it('removes an entry', () => {
    stamps.items = [item()];
    const { container } = render(StampLibrary, props());
    (container.querySelector('.drop') as HTMLButtonElement).click();
    expect(stamps.items).toHaveLength(0);
  });

  it('asks for a png through the app, not through the browser', () => {
    const onimport = vi.fn();
    const { container } = render(StampLibrary, props({ onimport }));
    const button = [...container.querySelectorAll('.head .text')].find((b) =>
      b.textContent?.includes('PNG'),
    ) as HTMLButtonElement;
    button.click();
    expect(onimport).toHaveBeenCalled();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it('keeps a name that was typed as a picture', async () => {
    const { container } = render(StampLibrary, props());
    const typeButton = [...container.querySelectorAll('.head .text')].find(
      (b) => b.textContent?.trim() === 'Escribir',
    ) as HTMLButtonElement;
    typeButton.click();
    await tick();

    const input = container.querySelector('.typed') as HTMLInputElement;
    input.value = 'Esteban Salas';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    (container.querySelector('.primary') as HTMLButtonElement).click();

    expect(stamps.items).toHaveLength(1);
    expect(stamps.items[0]?.kind).toBe('image');
    expect(stamps.items[0]?.name).toBe('Esteban Salas');
  });

  it('closes when the backdrop is pressed', () => {
    const onclose = vi.fn();
    const { container } = render(StampLibrary, props({ onclose }));
    (container.querySelector('.backdrop') as HTMLElement).click();
    expect(onclose).toHaveBeenCalled();
  });
});
