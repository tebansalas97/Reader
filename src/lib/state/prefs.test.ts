import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, mergePrefs } from './prefs.svelte';

describe('mergePrefs', () => {
  it('returns defaults for an empty object', () => {
    expect(mergePrefs({})).toEqual(DEFAULT_PREFS);
  });

  it('keeps valid stored values', () => {
    expect(mergePrefs({ theme: 'dark' }).theme).toBe('dark');
  });

  it('rejects a value outside the allowed set', () => {
    expect(mergePrefs({ theme: 'neon' as never }).theme).toBe(DEFAULT_PREFS.theme);
  });

  it('clamps the font size into range', () => {
    expect(mergePrefs({ editorFontSize: 2 }).editorFontSize).toBe(10);
    expect(mergePrefs({ editorFontSize: 400 }).editorFontSize).toBe(32);
  });

  it('clamps the split ratio', () => {
    expect(mergePrefs({ splitRatio: 0.01 }).splitRatio).toBe(0.2);
    expect(mergePrefs({ splitRatio: 0.99 }).splitRatio).toBe(0.8);
  });

  it('rejects a non-numeric autosave delay', () => {
    expect(mergePrefs({ autosaveDelayMs: NaN }).autosaveDelayMs).toBe(DEFAULT_PREFS.autosaveDelayMs);
  });

  it('rejects an empty font string', () => {
    expect(mergePrefs({ editorFont: '   ' }).editorFont).toBe(DEFAULT_PREFS.editorFont);
  });

  it('ignores unknown keys', () => {
    const merged = mergePrefs({ nope: 1 } as never);
    expect('nope' in merged).toBe(false);
  });

  it('keeps a stored folder path', () => {
    expect(mergePrefs({ lastFolder: 'C:/docs' }).lastFolder).toBe('C:/docs');
  });

  it('drops a non-string folder path', () => {
    expect(mergePrefs({ lastFolder: 5 as never }).lastFolder).toBeNull();
  });
});
