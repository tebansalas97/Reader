import { describe, expect, it } from 'vitest';
import { COMMANDS, filterCommands, fuzzyScore, normaliseQuery, type CommandEntry } from './commands';

const entries: CommandEntry[] = [
  { id: 'save', labelKey: 'save', group: 'file', needsDocument: true },
  { id: 'open', labelKey: 'open', group: 'file', needsDocument: false },
  { id: 'table', labelKey: 'table', group: 'insert', needsDocument: true },
];

const dictionary: Record<string, string> = {
  save: 'Guardar',
  open: 'Abrir archivo',
  table: 'Tabla',
};

const translate = (key: string) => dictionary[key] ?? key;

describe('normaliseQuery', () => {
  it('lowercases and strips accents', () => {
    expect(normaliseQuery('  Título ')).toBe('titulo');
  });
});

describe('fuzzyScore', () => {
  it('gives every entry a score for an empty query', () => {
    expect(fuzzyScore('cualquiera', '')).toBeGreaterThan(0);
  });

  it('ranks a prefix match highest', () => {
    expect(fuzzyScore('Guardar', 'gua')).toBeGreaterThan(fuzzyScore('Reguardar', 'gua'));
  });

  it('matches ignoring accents', () => {
    expect(fuzzyScore('Título', 'titulo')).toBeGreaterThan(0);
  });

  it('matches scattered letters', () => {
    expect(fuzzyScore('Abrir archivo', 'arch')).toBeGreaterThan(0);
  });

  it('returns zero when the letters are absent', () => {
    expect(fuzzyScore('Guardar', 'xyz')).toBe(0);
  });

  it('returns zero when the letters are out of order', () => {
    expect(fuzzyScore('abc', 'cba')).toBe(0);
  });
});

describe('filterCommands', () => {
  it('returns every available command for an empty query', () => {
    expect(filterCommands(entries, '', translate, true)).toHaveLength(3);
  });

  it('hides commands that need a document when none is open', () => {
    const result = filterCommands(entries, '', translate, false);
    expect(result.map((r) => r.id)).toEqual(['open']);
  });

  it('filters by the translated label, not the key', () => {
    const result = filterCommands(entries, 'guardar', translate, true);
    expect(result[0]?.id).toBe('save');
  });

  it('drops entries that do not match', () => {
    expect(filterCommands(entries, 'zzz', translate, true)).toHaveLength(0);
  });

  it('puts the best match first', () => {
    const result = filterCommands(entries, 'tab', translate, true);
    expect(result[0]?.id).toBe('table');
  });
});

describe('COMMANDS', () => {
  it('has no duplicate identifiers', () => {
    const ids = COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every command a group', () => {
    expect(COMMANDS.every((c) => c.group.length > 0)).toBe(true);
  });
});
