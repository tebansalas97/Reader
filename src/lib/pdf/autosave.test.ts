import { describe, expect, it } from 'vitest';
import { MIN_PDF_DELAY, pdfAutosaveDelay, shouldAutosavePdf, type AutosaveState } from './autosave';

function state(overrides: Partial<AutosaveState> = {}): AutosaveState {
  return {
    mode: 'afterDelay',
    dirty: true,
    hasPath: true,
    saving: false,
    selected: false,
    editingText: false,
    ...overrides,
  };
}

describe('pdfAutosaveDelay', () => {
  it('never waits less than the floor', () => {
    expect(pdfAutosaveDelay(1000)).toBe(MIN_PDF_DELAY);
  });

  it('respects a longer wait', () => {
    expect(pdfAutosaveDelay(10000)).toBe(10000);
  });
});

describe('shouldAutosavePdf', () => {
  it('saves a dirty document that lives on disk', () => {
    expect(shouldAutosavePdf(state())).toBe(true);
  });

  it('stays quiet when autosave is off', () => {
    expect(shouldAutosavePdf(state({ mode: 'off' }))).toBe(false);
    expect(shouldAutosavePdf(state({ mode: 'onFocusChange' }))).toBe(false);
  });

  it('stays quiet with nothing to save', () => {
    expect(shouldAutosavePdf(state({ dirty: false }))).toBe(false);
  });

  it('stays quiet for a document without a path', () => {
    expect(shouldAutosavePdf(state({ hasPath: false }))).toBe(false);
  });

  it('does not pile on a save in flight', () => {
    expect(shouldAutosavePdf(state({ saving: true }))).toBe(false);
  });

  it('waits while an annotation is selected', () => {
    expect(shouldAutosavePdf(state({ selected: true }))).toBe(false);
  });

  it('waits while text is being edited', () => {
    expect(shouldAutosavePdf(state({ editingText: true }))).toBe(false);
  });
});
