import { getPrefs, setPrefs } from '$lib/fs/api';

export interface Prefs {
  theme: 'system' | 'light' | 'dark';
  editorFont: string;
  editorFontSize: number;
  previewFont: string;
  previewFontSize: number;
  previewWidth: number;
  tabSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  autosave: 'off' | 'afterDelay' | 'onFocusChange';
  autosaveDelayMs: number;
  language: 'es' | 'en';
  splitRatio: number;
  lastFolder: string | null;
  scrollSync: boolean;
  showToolbar: boolean;
  highlightActiveBlock: boolean;
  focusMode: boolean;
  typewriter: boolean;
  spellCheck: boolean;
  spellLanguage: 'es' | 'en';
  formatTablesOnSave: boolean;
  localHistory: boolean;
  personalDictionary: string[];
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  editorFont: "'Cascadia Code', Consolas, 'Courier New', monospace",
  editorFontSize: 14,
  previewFont: "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif",
  previewFontSize: 16,
  previewWidth: 760,
  tabSize: 2,
  wordWrap: true,
  lineNumbers: false,
  autosave: 'afterDelay',
  autosaveDelayMs: 1000,
  language: 'es',
  splitRatio: 0.5,
  lastFolder: null,
  scrollSync: true,
  showToolbar: true,
  highlightActiveBlock: true,
  focusMode: false,
  typewriter: false,
  spellCheck: false,
  spellLanguage: 'es',
  formatTablesOnSave: true,
  localHistory: true,
  personalDictionary: [],
};

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function clamped(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

export function mergePrefs(stored: Partial<Prefs>): Prefs {
  const d = DEFAULT_PREFS;
  return {
    theme: oneOf(stored.theme, ['system', 'light', 'dark'] as const, d.theme),
    editorFont: text(stored.editorFont, d.editorFont),
    editorFontSize: clamped(stored.editorFontSize, 10, 32, d.editorFontSize),
    previewFont: text(stored.previewFont, d.previewFont),
    previewFontSize: clamped(stored.previewFontSize, 12, 32, d.previewFontSize),
    previewWidth: clamped(stored.previewWidth, 480, 1600, d.previewWidth),
    tabSize: clamped(stored.tabSize, 1, 8, d.tabSize),
    wordWrap: bool(stored.wordWrap, d.wordWrap),
    lineNumbers: bool(stored.lineNumbers, d.lineNumbers),
    autosave: oneOf(stored.autosave, ['off', 'afterDelay', 'onFocusChange'] as const, d.autosave),
    autosaveDelayMs: clamped(stored.autosaveDelayMs, 200, 60000, d.autosaveDelayMs),
    language: oneOf(stored.language, ['es', 'en'] as const, d.language),
    splitRatio: clamped(stored.splitRatio, 0.2, 0.8, d.splitRatio),
    lastFolder: typeof stored.lastFolder === 'string' ? stored.lastFolder : null,
    scrollSync: bool(stored.scrollSync, d.scrollSync),
    showToolbar: bool(stored.showToolbar, d.showToolbar),
    highlightActiveBlock: bool(stored.highlightActiveBlock, d.highlightActiveBlock),
    focusMode: bool(stored.focusMode, d.focusMode),
    typewriter: bool(stored.typewriter, d.typewriter),
    spellCheck: bool(stored.spellCheck, d.spellCheck),
    spellLanguage: oneOf(stored.spellLanguage, ['es', 'en'] as const, d.spellLanguage),
    formatTablesOnSave: bool(stored.formatTablesOnSave, d.formatTablesOnSave),
    localHistory: bool(stored.localHistory, d.localHistory),
    personalDictionary: Array.isArray(stored.personalDictionary)
      ? stored.personalDictionary.filter((w): w is string => typeof w === 'string')
      : [],
  };
}

class PrefsStore {
  current = $state<Prefs>({ ...DEFAULT_PREFS });
  private timer: ReturnType<typeof setTimeout> | null = null;

  async load(): Promise<void> {
    const stored = await getPrefs<Prefs>().catch(() => ({}) as Partial<Prefs>);
    this.current = mergePrefs(stored);
  }

  update(patch: Partial<Prefs>): void {
    this.current = mergePrefs({ ...this.current, ...patch });
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void setPrefs($state.snapshot(this.current)).catch(() => undefined);
    }, 300);
  }
}

export const prefs = new PrefsStore();

export function systemTheme(): 'light' | 'dark' {
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolvedTheme(): 'light' | 'dark' {
  return prefs.current.theme === 'system' ? systemTheme() : prefs.current.theme;
}

export function zoomEditor(delta: number): void {
  prefs.update({
    editorFontSize: prefs.current.editorFontSize + delta,
    previewFontSize: prefs.current.previewFontSize + delta,
  });
}

export function resetZoom(): void {
  prefs.update({
    editorFontSize: DEFAULT_PREFS.editorFontSize,
    previewFontSize: DEFAULT_PREFS.previewFontSize,
  });
}
