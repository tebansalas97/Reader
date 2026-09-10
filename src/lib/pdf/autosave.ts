export const MIN_PDF_DELAY = 3000;

export interface AutosaveState {
  mode: 'off' | 'afterDelay' | 'onFocusChange';
  dirty: boolean;
  hasPath: boolean;
  saving: boolean;
  selected: boolean;
  editingText: boolean;
}

export function pdfAutosaveDelay(delayMs: number): number {
  return Math.max(MIN_PDF_DELAY, delayMs);
}

export function shouldAutosavePdf(state: AutosaveState): boolean {
  if (state.mode !== 'afterDelay') return false;
  if (!state.dirty || !state.hasPath) return false;
  if (state.saving) return false;
  return !state.selected && !state.editingText;
}
