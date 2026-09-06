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
  'ctrl+p': 'print',
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

export function registerShortcuts(handlers: Record<string, () => void>): () => void {
  function onKeyDown(event: KeyboardEvent): void {
    const action = matchShortcut(event);
    if (action === null) return;
    const handler = handlers[action];
    if (!handler) return;
    event.preventDefault();
    event.stopPropagation();
    handler();
  }
  window.addEventListener('keydown', onKeyDown, true);
  return () => window.removeEventListener('keydown', onKeyDown, true);
}
