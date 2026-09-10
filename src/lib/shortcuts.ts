const BINDINGS: Record<string, string> = {
  'ctrl+n': 'new',
  'ctrl+o': 'open',
  'ctrl+shift+o': 'openFolder',
  'ctrl+s': 'save',
  'ctrl+shift+s': 'saveAs',
  'ctrl+w': 'close',
  'ctrl+e': 'cycleView',
  'ctrl+shift+e': 'toggleFiles',
  'ctrl+shift+u': 'toggleOutline',
  'ctrl+,': 'settings',
  'ctrl+tab': 'nextTab',
  'ctrl+shift+tab': 'prevTab',
  'ctrl+shift+h': 'exportHtml',
  'ctrl+alt+p': 'exportPdf',
  'ctrl+p': 'print',
  'ctrl+shift+p': 'palette',
  'ctrl+shift+f': 'toggleSearch',
  'ctrl++': 'zoomIn',
  'ctrl+=': 'zoomIn',
  'ctrl+-': 'zoomOut',
  'ctrl+0': 'zoomReset',
  'ctrl+z': 'undo',
  'ctrl+y': 'redo',
  'ctrl+shift+z': 'redo',
  f11: 'toggleZen',
  escape: 'exitZen',
};

function comboOf(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('ctrl');
  if (event.shiftKey) parts.push('shift');
  if (event.altKey) parts.push('alt');
  parts.push(event.key.toLowerCase());
  return parts.join('+');
}

export function matchShortcut(event: KeyboardEvent): string | null {
  return BINDINGS[comboOf(event)] ?? null;
}

export type ShortcutHandler = () => void | boolean;

export function registerShortcuts(handlers: Record<string, ShortcutHandler>): () => void {
  function onKeyDown(event: KeyboardEvent): void {
    const action = matchShortcut(event);
    if (action === null) return;
    const handler = handlers[action];
    if (!handler) return;
    if (handler() === false) return;
    event.preventDefault();
    event.stopPropagation();
  }
  window.addEventListener('keydown', onKeyDown, true);
  return () => window.removeEventListener('keydown', onKeyDown, true);
}
