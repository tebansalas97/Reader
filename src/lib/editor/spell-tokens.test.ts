import { describe, expect, it } from 'vitest';
import { isCheckable, maskedRegions, normaliseWord, tokenizeWords } from './spell-tokens';

function words(text: string): string[] {
  return tokenizeWords(text).map((t) => t.word);
}

describe('isCheckable', () => {
  it('accepts an ordinary word', () => {
    expect(isCheckable('palabra')).toBe(true);
  });

  it('rejects very short words', () => {
    expect(isCheckable('de')).toBe(false);
  });

  it('rejects anything with a digit', () => {
    expect(isCheckable('sha256')).toBe(false);
  });

  it('rejects a short acronym', () => {
    expect(isCheckable('HTML')).toBe(false);
  });

  it('accepts a long uppercase word', () => {
    expect(isCheckable('MARKDOWN')).toBe(true);
  });
});

describe('tokenizeWords', () => {
  it('finds the words of a sentence', () => {
    expect(words('una frase sencilla')).toEqual(['una', 'frase', 'sencilla']);
  });

  it('keeps accented letters inside the word', () => {
    expect(words('la canción sonaba')).toContain('canción');
  });

  it('reports the position of each word', () => {
    const tokens = tokenizeWords('hola mundo');
    expect(tokens[1]).toEqual({ from: 5, to: 10, word: 'mundo' });
  });

  it('shifts positions by the offset', () => {
    expect(tokenizeWords('hola', 100)[0]?.from).toBe(100);
  });

  it('skips inline code', () => {
    expect(words('usa `npmm insstall` siempre')).toEqual(['usa', 'siempre']);
  });

  it('skips fenced code blocks', () => {
    expect(words('antes\n```\nlorm ipsm\n```\ndespues')).toEqual(['antes', 'despues']);
  });

  it('skips an unterminated fence to the end', () => {
    expect(words('antes\n```\nlorm ipsm')).toEqual(['antes']);
  });

  it('skips indented code blocks', () => {
    expect(words('parrafo\n\n    codigoo raroo\n')).toEqual(['parrafo']);
  });

  it('skips urls', () => {
    expect(words('mira https://ejemplo.com/rutaa ahora')).toEqual(['mira', 'ahora']);
  });

  it('skips email addresses', () => {
    expect(words('escribe a nadiee@ejemploo.com hoy')).toEqual(['escribe', 'hoy']);
  });

  it('skips link targets but keeps the label', () => {
    expect(words('ver [el sitio](https://unaa.com/xyz)')).toEqual(['ver', 'sitio']);
  });

  it('skips html tags', () => {
    expect(words('texto <img srcc="xx"> final')).toEqual(['texto', 'final']);
  });

  it('skips math', () => {
    expect(words('la formula $E = mcc^2$ dice')).toEqual(['formula', 'dice']);
  });

  it('drops a trailing apostrophe or hyphen', () => {
    expect(words("el nino' juega")).toContain('nino');
  });

  it('returns nothing for an empty document', () => {
    expect(words('')).toEqual([]);
  });
});

describe('maskedRegions', () => {
  it('merges overlapping regions', () => {
    const regions = maskedRegions('`uno` `dos`');
    expect(regions).toHaveLength(2);
  });

  it('returns nothing for plain text', () => {
    expect(maskedRegions('solo texto llano')).toEqual([]);
  });
});

describe('normaliseWord', () => {
  it('turns a typographic apostrophe into a plain one', () => {
    expect(normaliseWord('don’t')).toBe("don't");
  });
});
