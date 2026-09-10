import { describe, expect, it } from 'vitest';
import { decodeHex, decodeLiteral, decodeString, encodeLiteral, tokenize } from './tokens';

function kinds(source: string): string[] {
  return tokenize(source).map((token) => token.kind);
}

function texts(source: string): string[] {
  return tokenize(source).map((token) => token.text);
}

describe('tokenize', () => {
  it('reads a simple show-text operation', () => {
    expect(texts('BT /F1 12 Tf (hola) Tj ET')).toEqual([
      'BT',
      '/F1',
      '12',
      'Tf',
      '(hola)',
      'Tj',
      'ET',
    ]);
  });

  it('tells numbers from operators', () => {
    expect(kinds('1 -2 .5 3.25 Td')).toEqual(['number', 'number', 'number', 'number', 'operator']);
  });

  it('keeps a string with brackets inside', () => {
    expect(texts('((uno) dos) Tj')[0]).toBe('((uno) dos)');
  });

  it('keeps a string with an escaped bracket', () => {
    expect(texts('(a\\)b) Tj')[0]).toBe('(a\\)b)');
  });

  it('reads a hex string', () => {
    expect(kinds('<48656c6c6f> Tj')).toEqual(['hex', 'operator']);
  });

  it('reads an array', () => {
    expect(kinds('[(a) -250 (b)] TJ')).toEqual([
      'open-array',
      'string',
      'number',
      'string',
      'close-array',
      'operator',
    ]);
  });

  it('reads a dictionary', () => {
    expect(kinds('<< /Type /Page >>')).toEqual(['open-dict', 'name', 'name', 'close-dict']);
  });

  it('skips a comment', () => {
    expect(kinds('% esto no cuenta\n(a) Tj')).toEqual(['comment', 'string', 'operator']);
  });

  it('swallows an inline image whole, binary and all', () => {
    const source = 'q BI /W 2 /H 2 ID \x00(\\)[]% EI Q';
    const tokens = tokenize(source);
    expect(tokens.map((t) => t.kind)).toEqual(['operator', 'inline-image', 'operator']);
    expect(tokens[2]?.text).toBe('Q');
  });

  it('remembers where every token was', () => {
    const tokens = tokenize('BT (hola) Tj ET');
    const source = 'BT (hola) Tj ET';
    for (const token of tokens) {
      expect(source.slice(token.start, token.end)).toBe(token.text);
    }
  });

  it('survives a string that never closes', () => {
    expect(() => tokenize('(sin final')).not.toThrow();
  });

  it('reads a name with an escape in it', () => {
    expect(texts('/A#20B Do')[0]).toBe('/A#20B');
  });

  it('gives nothing for an empty stream', () => {
    expect(tokenize('   \n  ')).toEqual([]);
  });
});

describe('decodeLiteral', () => {
  it('reads plain text', () => {
    expect(decodeLiteral('(hola)')).toBe('hola');
  });

  it('reads an escaped bracket', () => {
    expect(decodeLiteral('(a\\)b)')).toBe('a)b');
  });

  it('reads an octal escape', () => {
    expect(decodeLiteral('(a\\351b)')).toBe('aéb');
  });

  it('reads the usual escapes', () => {
    expect(decodeLiteral('(a\\nb\\tc)')).toBe('a\nb\tc');
  });

  it('joins a line that was split with a backslash', () => {
    expect(decodeLiteral('(uno\\\ndos)')).toBe('unodos');
  });
});

describe('decodeHex', () => {
  it('reads a hex string', () => {
    expect(decodeHex('<48656c6c6f>')).toBe('Hello');
  });

  it('pads an odd number of digits', () => {
    expect(decodeHex('<4A5>')).toBe('J P'.replace(' P', 'P'));
  });

  it('ignores what is not a digit', () => {
    expect(decodeHex('<48 65>')).toBe('He');
  });
});

describe('decodeString', () => {
  it('reads either kind of string', () => {
    const [literal] = tokenize('(hola)');
    const [hex] = tokenize('<686f6c61>');
    expect(decodeString(literal!)).toBe('hola');
    expect(decodeString(hex!)).toBe('hola');
  });

  it('gives nothing for something that is not a string', () => {
    const [operator] = tokenize('Tj');
    expect(decodeString(operator!)).toBe('');
  });
});

describe('encodeLiteral', () => {
  it('writes plain text as it comes', () => {
    expect(encodeLiteral('hola')).toBe('(hola)');
  });

  it('escapes the brackets and the backslash', () => {
    expect(encodeLiteral('a(b)c\\')).toBe('(a\\(b\\)c\\\\)');
  });

  it('writes a high byte as octal', () => {
    expect(encodeLiteral('é')).toBe('(\\351)');
  });

  it('comes back the same after being read', () => {
    const value = 'Señor (jefe) \\ 100%';
    expect(decodeLiteral(encodeLiteral(value))).toBe(value);
  });
});
