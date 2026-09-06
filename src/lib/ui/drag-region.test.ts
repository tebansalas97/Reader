import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Menu from './Menu.svelte';
import Tabs from './Tabs.svelte';

const DOCS = [
  { id: 'a', title: 'uno.md', dirty: false },
  { id: 'b', title: 'dos.md', dirty: false },
];

function draggable(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll('[data-tauri-drag-region]'));
}

describe('window dragging', () => {
  it('makes the empty area of the tab strip draggable', () => {
    const { container } = render(Tabs, {
      items: DOCS,
      activeId: 'a',
      onselect: vi.fn(),
      onclose: vi.fn(),
    });
    expect(container.querySelector('.tabs')?.hasAttribute('data-tauri-drag-region')).toBe(true);
  });

  it('keeps the tabs themselves out of the drag region', () => {
    const { container } = render(Tabs, {
      items: DOCS,
      activeId: 'a',
      onselect: vi.fn(),
      onclose: vi.fn(),
    });
    for (const tab of Array.from(container.querySelectorAll('.tab'))) {
      expect(tab.hasAttribute('data-tauri-drag-region')).toBe(false);
    }
  });

  it('keeps the close buttons out of the drag region', () => {
    const { container } = render(Tabs, {
      items: DOCS,
      activeId: 'a',
      onselect: vi.fn(),
      onclose: vi.fn(),
    });
    for (const button of Array.from(container.querySelectorAll('button'))) {
      expect(button.hasAttribute('data-tauri-drag-region')).toBe(false);
    }
  });

  it('makes the strip draggable even with no documents open', () => {
    const { container } = render(Tabs, {
      items: [],
      activeId: null,
      onselect: vi.fn(),
      onclose: vi.fn(),
    });
    expect(draggable(container)).toHaveLength(1);
  });

  it('makes the menu background draggable', () => {
    const { container } = render(Menu, { onaction: vi.fn() });
    expect(container.querySelector('.menu')?.hasAttribute('data-tauri-drag-region')).toBe(true);
  });

  it('keeps the menu button out of the drag region', () => {
    const { container } = render(Menu, { onaction: vi.fn() });
    expect(
      container.querySelector('.trigger')?.hasAttribute('data-tauri-drag-region'),
    ).toBe(false);
  });
});
