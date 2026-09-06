import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Outline from './Outline.svelte';

const items = [
  { level: 1, text: 'Uno', line: 0, id: 'uno' },
  { level: 2, text: 'Dos', line: 4, id: 'dos' },
];

describe('Outline', () => {
  it('renders one entry per heading', () => {
    render(Outline, { items, activeIndex: 0, onselect: vi.fn() });
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('indents by heading level', () => {
    render(Outline, { items, activeIndex: 0, onselect: vi.fn() });
    expect(screen.getByText('Dos').dataset.level).toBe('2');
  });

  it('marks the active heading', () => {
    render(Outline, { items, activeIndex: 1, onselect: vi.fn() });
    expect(screen.getByText('Dos').getAttribute('aria-current')).toBe('true');
  });

  it('reports the line when an entry is clicked', () => {
    const onselect = vi.fn();
    render(Outline, { items, activeIndex: 0, onselect });
    screen.getByText('Dos').click();
    expect(onselect).toHaveBeenCalledWith(4);
  });

  it('shows a placeholder when there are no headings', () => {
    render(Outline, { items: [], activeIndex: -1, onselect: vi.fn() });
    expect(screen.getByText('Sin títulos')).toBeTruthy();
  });
});
