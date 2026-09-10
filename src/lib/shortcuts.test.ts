import { describe, expect, it, vi } from 'vitest';
import { matchShortcut, registerShortcuts } from './shortcuts';

function key(init: Partial<KeyboardEventInit> & { key: string }): KeyboardEvent {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
}

describe('matchShortcut', () => {
  it('maps Ctrl+S to save', () => {
    expect(matchShortcut(key({ key: 's', ctrlKey: true }))).toBe('save');
  });

  it('maps Ctrl+Shift+S to saveAs', () => {
    expect(matchShortcut(key({ key: 'S', ctrlKey: true, shiftKey: true }))).toBe('saveAs');
  });

  it('maps Ctrl+E to cycleView', () => {
    expect(matchShortcut(key({ key: 'e', ctrlKey: true }))).toBe('cycleView');
  });

  it('maps F11 to toggleZen without any modifier', () => {
    expect(matchShortcut(key({ key: 'F11' }))).toBe('toggleZen');
  });

  it('maps Escape to exitZen', () => {
    expect(matchShortcut(key({ key: 'Escape' }))).toBe('exitZen');
  });

  it('maps Ctrl+Tab to nextTab', () => {
    expect(matchShortcut(key({ key: 'Tab', ctrlKey: true }))).toBe('nextTab');
  });

  it('maps Ctrl+Shift+Tab to prevTab', () => {
    expect(matchShortcut(key({ key: 'Tab', ctrlKey: true, shiftKey: true }))).toBe('prevTab');
  });

  it('is case insensitive on the letter', () => {
    expect(matchShortcut(key({ key: 'S', ctrlKey: true }))).toBe('save');
  });

  it('returns null for an unbound combination', () => {
    expect(matchShortcut(key({ key: 'q', ctrlKey: true }))).toBeNull();
  });

  it('returns null for a plain letter so typing is never intercepted', () => {
    expect(matchShortcut(key({ key: 's' }))).toBeNull();
  });

  it('ignores Ctrl+B because the editor owns it', () => {
    expect(matchShortcut(key({ key: 'b', ctrlKey: true }))).toBeNull();
  });

  it('ignores Ctrl+F because the editor search panel owns it', () => {
    expect(matchShortcut(key({ key: 'f', ctrlKey: true }))).toBeNull();
  });
});

describe('registerShortcuts', () => {
  it('calls the matching handler and prevents the default', () => {
    const save = vi.fn();
    const off = registerShortcuts({ save });
    const event = key({ key: 's', ctrlKey: true });
    window.dispatchEvent(event);
    expect(save).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    off();
  });

  it('does nothing when no handler is registered for the action', () => {
    const off = registerShortcuts({});
    const event = key({ key: 's', ctrlKey: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    off();
  });

  it('stops listening after the returned function is called', () => {
    const save = vi.fn();
    const off = registerShortcuts({ save });
    off();
    window.dispatchEvent(key({ key: 's', ctrlKey: true }));
    expect(save).not.toHaveBeenCalled();
  });
});

describe('handlers that decline', () => {
  it('lets the key through when the handler says no', () => {
    const stop = registerShortcuts({ undo: () => false });
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    stop();
  });

  it('takes the key when the handler deals with it', () => {
    const stop = registerShortcuts({ undo: () => true });
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    stop();
  });

  it('knows the three ways of asking for undo and redo', () => {
    expect(matchShortcut(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))).toBe('undo');
    expect(matchShortcut(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }))).toBe('redo');
    expect(
      matchShortcut(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true })),
    ).toBe('redo');
  });
});
