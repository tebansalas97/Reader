import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addPersonal,
  ensureSpelling,
  isMisspelled,
  isPersonal,
  loadPersonal,
  personalWords,
  removePersonal,
  resetSpelling,
  spellingReady,
  suggestionsFor,
} from './spell';

const root = join(process.cwd(), 'public', 'dictionaries');

beforeEach(() => {
  resetSpelling();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = url.split('/').pop() ?? '';
      const body = await readFile(join(root, name), 'utf8');
      return { ok: true, status: 200, text: async () => body } as unknown as Response;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetSpelling();
});

describe('ensureSpelling', () => {
  it('is not ready before loading', () => {
    expect(spellingReady('es')).toBe(false);
  });

  it('becomes ready after loading', async () => {
    await ensureSpelling('es');
    expect(spellingReady('es')).toBe(true);
  });

  it('loads each dictionary only once', async () => {
    await ensureSpelling('es');
    await ensureSpelling('es');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});

describe('isMisspelled in Spanish', () => {
  beforeEach(async () => {
    await ensureSpelling('es');
  });

  it('accepts a correct word', () => {
    expect(isMisspelled('palabra', 'es')).toBe(false);
  });

  it('accepts a word with an accent', () => {
    expect(isMisspelled('canción', 'es')).toBe(false);
  });

  it('flags a misspelling', () => {
    expect(isMisspelled('palabraa', 'es')).toBe(true);
  });

  it('flags a missing accent that changes the word', () => {
    expect(isMisspelled('parafo', 'es')).toBe(true);
  });

  it('accepts a capitalised word', () => {
    expect(isMisspelled('Palabra', 'es')).toBe(false);
  });

  it('returns the same verdict on a second call', () => {
    expect(isMisspelled('palabraa', 'es')).toBe(isMisspelled('palabraa', 'es'));
  });
});

describe('isMisspelled in English', () => {
  beforeEach(async () => {
    await ensureSpelling('en');
  });

  it('accepts a correct word', () => {
    expect(isMisspelled('written', 'en')).toBe(false);
  });

  it('flags a misspelling', () => {
    expect(isMisspelled('writen', 'en')).toBe(true);
  });

  it('flags another misspelling', () => {
    expect(isMisspelled('mispelled', 'en')).toBe(true);
  });
});

describe('suggestionsFor', () => {
  beforeEach(async () => {
    await ensureSpelling('es');
  });

  it('suggests the right word', () => {
    expect(suggestionsFor('palabraa', 'es')).toContain('palabra');
  });

  it('returns at most eight suggestions', () => {
    expect(suggestionsFor('palabraa', 'es').length).toBeLessThanOrEqual(8);
  });

  it('returns nothing when the dictionary is not loaded', () => {
    expect(suggestionsFor('writen', 'en')).toEqual([]);
  });
});

describe('personal dictionary', () => {
  beforeEach(async () => {
    await ensureSpelling('es');
  });

  it('stops flagging a word that was added', () => {
    expect(isMisspelled('palabraa', 'es')).toBe(true);
    addPersonal('palabraa');
    expect(isMisspelled('palabraa', 'es')).toBe(false);
  });

  it('ignores the case of an added word', () => {
    addPersonal('Tauri');
    expect(isPersonal('tauri')).toBe(true);
  });

  it('flags the word again after removing it', () => {
    addPersonal('palabraa');
    removePersonal('palabraa');
    expect(isMisspelled('palabraa', 'es')).toBe(true);
  });

  it('lists the added words sorted', () => {
    loadPersonal(['zeta', 'alfa']);
    expect(personalWords()).toEqual(['alfa', 'zeta']);
  });

  it('replaces the list when loading a new one', () => {
    addPersonal('uno');
    loadPersonal(['dos']);
    expect(personalWords()).toEqual(['dos']);
  });
});

describe('without a dictionary', () => {
  it('never flags anything', () => {
    expect(isMisspelled('palabraa', 'es')).toBe(false);
  });
});
