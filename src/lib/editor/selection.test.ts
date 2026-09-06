import { describe, expect, it } from 'vitest';
import {
  isTaskLine,
  sentenceRangeAt,
  toggleTaskAtLine,
  toggleTaskInLine,
  wordRangeAt,
} from './selection';

function slice(text: string, range: { from: number; to: number }): string {
  return text.slice(range.from, range.to);
}

describe('wordRangeAt', () => {
  const text = 'hola mundo cruel';

  it('selects the word under the caret', () => {
    expect(slice(text, wordRangeAt(text, 6))).toBe('mundo');
  });

  it('selects the word when the caret sits at its start', () => {
    expect(slice(text, wordRangeAt(text, 5))).toBe('mundo');
  });

  it('selects the word when the caret sits at its end', () => {
    expect(slice(text, wordRangeAt(text, 10))).toBe('mundo');
  });

  it('selects a word with accents whole', () => {
    const accented = 'la canción termina';
    expect(slice(accented, wordRangeAt(accented, 6))).toBe('canción');
  });

  it('selects a word with digits and underscores whole', () => {
    const code = 'const valor_2 = 1';
    expect(slice(code, wordRangeAt(code, 8))).toBe('valor_2');
  });

  it('selects a single punctuation character', () => {
    const punctuation = 'uno, dos';
    expect(slice(punctuation, wordRangeAt(punctuation, 3))).toBe(',');
  });

  it('never crosses a line break', () => {
    const twoLines = 'uno\ndos';
    expect(wordRangeAt(twoLines, 3)).toEqual({ from: 0, to: 3 });
  });

  it('handles an empty document', () => {
    expect(wordRangeAt('', 0)).toEqual({ from: 0, to: 0 });
  });

  it('handles a position past the end', () => {
    expect(slice(text, wordRangeAt(text, 999))).toBe('cruel');
  });
});

describe('sentenceRangeAt', () => {
  const text = 'Primera frase. Segunda frase aqui! Tercera y ultima.';

  it('selects the sentence under the caret', () => {
    expect(slice(text, sentenceRangeAt(text, 20))).toBe('Segunda frase aqui!');
  });

  it('selects the first sentence', () => {
    expect(slice(text, sentenceRangeAt(text, 3))).toBe('Primera frase.');
  });

  it('selects the last sentence', () => {
    expect(slice(text, sentenceRangeAt(text, 40))).toBe('Tercera y ultima.');
  });

  it('never includes the newline', () => {
    const lines = 'Una frase.\nOtra linea.';
    const range = sentenceRangeAt(lines, 3);
    expect(slice(lines, range)).toBe('Una frase.');
    expect(lines[range.to]).toBe('\n');
  });

  it('stays inside its own line', () => {
    const lines = 'Primera.\nSegunda frase larga.';
    expect(slice(lines, sentenceRangeAt(lines, 15))).toBe('Segunda frase larga.');
  });

  it('selects the whole line when there is no terminator', () => {
    const plain = '# Un titulo sin punto';
    expect(slice(plain, sentenceRangeAt(plain, 5))).toBe(plain);
  });

  it('does not split a decimal number', () => {
    const decimal = 'Pesa 3.5 kilos exactos.';
    expect(slice(decimal, sentenceRangeAt(decimal, 12))).toBe(decimal);
  });

  it('handles an empty document', () => {
    expect(sentenceRangeAt('', 0)).toEqual({ from: 0, to: 0 });
  });

  it('trims surrounding whitespace', () => {
    const padded = '   Con espacios delante.   ';
    expect(slice(padded, sentenceRangeAt(padded, 8))).toBe('Con espacios delante.');
  });
});

describe('isTaskLine', () => {
  it('detects an unchecked task', () => {
    expect(isTaskLine('- [ ] pendiente')).toBe(true);
  });

  it('detects a checked task', () => {
    expect(isTaskLine('- [x] hecho')).toBe(true);
  });

  it('detects a task in an ordered list', () => {
    expect(isTaskLine('1. [ ] pendiente')).toBe(true);
  });

  it('rejects a plain list item', () => {
    expect(isTaskLine('- normal')).toBe(false);
  });

  it('rejects a paragraph', () => {
    expect(isTaskLine('texto [ ] suelto')).toBe(false);
  });
});

describe('toggleTaskInLine', () => {
  it('checks an unchecked task', () => {
    expect(toggleTaskInLine('- [ ] pendiente')).toBe('- [x] pendiente');
  });

  it('unchecks a checked task', () => {
    expect(toggleTaskInLine('- [x] hecho')).toBe('- [ ] hecho');
  });

  it('unchecks an uppercase mark', () => {
    expect(toggleTaskInLine('- [X] hecho')).toBe('- [ ] hecho');
  });

  it('keeps the indentation', () => {
    expect(toggleTaskInLine('    - [ ] anidada')).toBe('    - [x] anidada');
  });

  it('keeps an asterisk marker', () => {
    expect(toggleTaskInLine('* [ ] otra')).toBe('* [x] otra');
  });

  it('returns null for a line that is not a task', () => {
    expect(toggleTaskInLine('- normal')).toBeNull();
  });
});

describe('toggleTaskAtLine', () => {
  const doc = '# Lista\n\n- [ ] uno\n- [x] dos\n\nfinal';

  it('toggles the requested line only', () => {
    expect(toggleTaskAtLine(doc, 2)).toBe('# Lista\n\n- [x] uno\n- [x] dos\n\nfinal');
  });

  it('unchecks the other one', () => {
    expect(toggleTaskAtLine(doc, 3)).toBe('# Lista\n\n- [ ] uno\n- [ ] dos\n\nfinal');
  });

  it('returns null when the line is not a task', () => {
    expect(toggleTaskAtLine(doc, 0)).toBeNull();
  });

  it('returns null for a line out of range', () => {
    expect(toggleTaskAtLine(doc, 99)).toBeNull();
  });
});
