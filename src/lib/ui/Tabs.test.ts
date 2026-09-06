import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Tabs from './Tabs.svelte';

const docs = [
  { id: 'a', title: 'uno.md', dirty: false },
  { id: 'b', title: 'dos.md', dirty: true },
];

describe('Tabs', () => {
  it('renders one tab per document', () => {
    render(Tabs, { items: docs, activeId: 'a', onselect: vi.fn(), onclose: vi.fn() });
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('marks the active tab', () => {
    render(Tabs, { items: docs, activeId: 'b', onselect: vi.fn(), onclose: vi.fn() });
    expect(screen.getByRole('tab', { selected: true }).textContent).toContain('dos.md');
  });

  it('shows a dirty indicator only on modified documents', () => {
    render(Tabs, { items: docs, activeId: 'a', onselect: vi.fn(), onclose: vi.fn() });
    expect(screen.getAllByTitle('Sin guardar')).toHaveLength(1);
  });

  it('calls onselect with the document id', () => {
    const onselect = vi.fn();
    render(Tabs, { items: docs, activeId: 'a', onselect, onclose: vi.fn() });
    (screen.getAllByRole('tab')[1] as HTMLElement).click();
    expect(onselect).toHaveBeenCalledWith('b');
  });

  it('calls onclose from the close button without selecting', () => {
    const onselect = vi.fn();
    const onclose = vi.fn();
    render(Tabs, { items: docs, activeId: 'a', onselect, onclose });
    (screen.getAllByLabelText('Cerrar pestaña')[0] as HTMLElement).click();
    expect(onclose).toHaveBeenCalledWith('a');
    expect(onselect).not.toHaveBeenCalled();
  });

  it('renders nothing when there are no documents', () => {
    render(Tabs, { items: [], activeId: null, onselect: vi.fn(), onclose: vi.fn() });
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
});
