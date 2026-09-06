import { normaliseWord } from './spell-tokens';

export type SpellLanguage = 'es' | 'en';

interface Checker {
  correct(word: string): boolean;
  suggest(word: string): string[];
}

const BASE = import.meta.env.BASE_URL ?? '/';

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const body = await response.text();
  if (body.length === 0) throw new Error(`vacio ${url}`);
  return body;
}

async function loadFiles(language: SpellLanguage): Promise<{ aff: string; dic: string }> {
  const prefix = `${BASE}dictionaries/${language}`.replace(/\/{2,}/g, '/');
  const [aff, dic] = await Promise.all([
    fetchText(`${prefix}.aff`),
    fetchText(`${prefix}.dic`),
  ]);
  return { aff, dic };
}

const pending = new Map<SpellLanguage, Promise<Checker>>();
const loaded = new Map<SpellLanguage, Checker>();
const personal = new Set<string>();
const verdicts = new Map<string, boolean>();

export function personalWords(): string[] {
  return Array.from(personal).sort((a, b) => a.localeCompare(b));
}

export function loadPersonal(words: string[]): void {
  personal.clear();
  for (const word of words) personal.add(normaliseWord(word).toLowerCase());
  verdicts.clear();
}

export function addPersonal(word: string): void {
  personal.add(normaliseWord(word).toLowerCase());
  verdicts.clear();
}

export function removePersonal(word: string): void {
  personal.delete(normaliseWord(word).toLowerCase());
  verdicts.clear();
}

export function isPersonal(word: string): boolean {
  return personal.has(normaliseWord(word).toLowerCase());
}

export async function ensureSpelling(language: SpellLanguage): Promise<void> {
  if (loaded.has(language)) return;
  let job = pending.get(language);
  if (!job) {
    job = (async () => {
      const [{ default: nspell }, files] = await Promise.all([
        import('nspell'),
        loadFiles(language),
      ]);
      return nspell(files.aff, files.dic) as unknown as Checker;
    })();
    pending.set(language, job);
  }
  const checker = await job;
  loaded.set(language, checker);
  pending.delete(language);
  verdicts.clear();
}

export function spellingReady(language: SpellLanguage): boolean {
  return loaded.has(language);
}

export function isMisspelled(word: string, language: SpellLanguage): boolean {
  const plain = normaliseWord(word);
  const lower = plain.toLowerCase();
  if (personal.has(lower)) return false;
  const checker = loaded.get(language);
  if (!checker) return false;
  const key = `${language}:${plain}`;
  const cached = verdicts.get(key);
  if (cached !== undefined) return cached;
  let wrong = !checker.correct(plain);
  if (wrong && plain !== lower) wrong = !checker.correct(lower);
  if (verdicts.size > 20000) verdicts.clear();
  verdicts.set(key, wrong);
  return wrong;
}

export function suggestionsFor(word: string, language: SpellLanguage): string[] {
  const checker = loaded.get(language);
  if (!checker) return [];
  return checker.suggest(normaliseWord(word)).slice(0, 8);
}

export function resetSpelling(): void {
  pending.clear();
  loaded.clear();
  verdicts.clear();
  personal.clear();
}
