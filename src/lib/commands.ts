export interface CommandEntry {
  id: string;
  labelKey: string;
  hint?: string;
  group: 'file' | 'edit' | 'view' | 'insert';
  needsDocument: boolean;
}

export const COMMANDS: CommandEntry[] = [
  { id: 'new', labelKey: 'menu.new', hint: 'Ctrl+N', group: 'file', needsDocument: false },
  { id: 'open', labelKey: 'menu.open', hint: 'Ctrl+O', group: 'file', needsDocument: false },
  {
    id: 'openFolder',
    labelKey: 'menu.openFolder',
    hint: 'Ctrl+Shift+O',
    group: 'file',
    needsDocument: false,
  },
  { id: 'save', labelKey: 'menu.save', hint: 'Ctrl+S', group: 'file', needsDocument: true },
  {
    id: 'saveAs',
    labelKey: 'menu.saveAs',
    hint: 'Ctrl+Shift+S',
    group: 'file',
    needsDocument: true,
  },
  { id: 'close', labelKey: 'menu.close', hint: 'Ctrl+W', group: 'file', needsDocument: true },
  {
    id: 'exportHtml',
    labelKey: 'menu.exportHtml',
    hint: 'Ctrl+Shift+H',
    group: 'file',
    needsDocument: true,
  },
  { id: 'print', labelKey: 'menu.exportPdf', hint: 'Ctrl+P', group: 'file', needsDocument: true },

  { id: 'bold', labelKey: 'toolbar.bold', hint: 'Ctrl+B', group: 'edit', needsDocument: true },
  { id: 'italic', labelKey: 'toolbar.italic', hint: 'Ctrl+I', group: 'edit', needsDocument: true },
  { id: 'strike', labelKey: 'toolbar.strike', group: 'edit', needsDocument: true },
  { id: 'code', labelKey: 'toolbar.code', group: 'edit', needsDocument: true },
  { id: 'bullet', labelKey: 'toolbar.bullet', group: 'edit', needsDocument: true },
  { id: 'ordered', labelKey: 'toolbar.ordered', group: 'edit', needsDocument: true },
  { id: 'task', labelKey: 'toolbar.task', group: 'edit', needsDocument: true },
  { id: 'quote', labelKey: 'toolbar.quote', group: 'edit', needsDocument: true },
  { id: 'find', labelKey: 'toolbar.find', hint: 'Ctrl+F', group: 'edit', needsDocument: true },

  { id: 'link', labelKey: 'toolbar.link', hint: 'Ctrl+K', group: 'insert', needsDocument: true },
  { id: 'image', labelKey: 'toolbar.image', group: 'insert', needsDocument: true },
  { id: 'table', labelKey: 'toolbar.table', group: 'insert', needsDocument: true },
  { id: 'codeBlock', labelKey: 'toolbar.codeBlock', group: 'insert', needsDocument: true },
  { id: 'rule', labelKey: 'toolbar.rule', group: 'insert', needsDocument: true },

  { id: 'cycleView', labelKey: 'command.cycleView', hint: 'Ctrl+E', group: 'view', needsDocument: false },
  { id: 'viewEditor', labelKey: 'view.editor', group: 'view', needsDocument: false },
  { id: 'viewSplit', labelKey: 'view.split', group: 'view', needsDocument: false },
  { id: 'viewPreview', labelKey: 'view.preview', group: 'view', needsDocument: false },
  {
    id: 'toggleFiles',
    labelKey: 'sidebar.files',
    hint: 'Ctrl+Shift+E',
    group: 'view',
    needsDocument: false,
  },
  {
    id: 'toggleOutline',
    labelKey: 'sidebar.outline',
    hint: 'Ctrl+Shift+U',
    group: 'view',
    needsDocument: false,
  },
  { id: 'toggleZen', labelKey: 'view.zen', hint: 'F11', group: 'view', needsDocument: false },
  { id: 'toggleToolbar', labelKey: 'command.toggleToolbar', group: 'view', needsDocument: false },
  { id: 'toggleSync', labelKey: 'command.toggleSync', group: 'view', needsDocument: false },
  { id: 'zoomIn', labelKey: 'command.zoomIn', hint: 'Ctrl++', group: 'view', needsDocument: false },
  { id: 'zoomOut', labelKey: 'command.zoomOut', hint: 'Ctrl+-', group: 'view', needsDocument: false },
  { id: 'zoomReset', labelKey: 'command.zoomReset', hint: 'Ctrl+0', group: 'view', needsDocument: false },
  {
    id: 'toggleSearch',
    labelKey: 'sidebar.search',
    hint: 'Ctrl+Shift+F',
    group: 'view',
    needsDocument: false,
  },
  { id: 'toggleHistory', labelKey: 'sidebar.history', group: 'view', needsDocument: true },
  { id: 'toggleFocus', labelKey: 'command.focusMode', group: 'view', needsDocument: false },
  {
    id: 'toggleTypewriter',
    labelKey: 'command.typewriter',
    group: 'view',
    needsDocument: false,
  },
  { id: 'toggleSpell', labelKey: 'command.spellCheck', group: 'view', needsDocument: false },
  {
    id: 'formatTables',
    labelKey: 'command.formatTables',
    group: 'edit',
    needsDocument: true,
  },
  { id: 'settings', labelKey: 'menu.settings', hint: 'Ctrl+,', group: 'view', needsDocument: false },
];

export function normaliseQuery(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

export function fuzzyScore(label: string, query: string): number {
  if (query.length === 0) return 1;
  const haystack = normaliseQuery(label);
  const needle = normaliseQuery(query);
  const direct = haystack.indexOf(needle);
  if (direct === 0) return 1000;
  if (direct > 0) return 500 - direct;
  let index = 0;
  let score = 0;
  let streak = 0;
  for (const character of haystack) {
    if (character === needle[index]) {
      index += 1;
      streak += 1;
      score += streak;
      if (index === needle.length) return score;
    } else {
      streak = 0;
    }
  }
  return 0;
}

export interface ResolvedCommand extends CommandEntry {
  label: string;
  score: number;
}

export function filterCommands(
  entries: CommandEntry[],
  query: string,
  translate: (key: string) => string,
  hasDocument: boolean,
): ResolvedCommand[] {
  return entries
    .filter((entry) => hasDocument || !entry.needsDocument)
    .map((entry) => {
      const label = translate(entry.labelKey);
      return { ...entry, label, score: fuzzyScore(label, query) };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}
