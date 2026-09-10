export type TokenKind =
  | 'number'
  | 'string'
  | 'hex'
  | 'name'
  | 'open-array'
  | 'close-array'
  | 'open-dict'
  | 'close-dict'
  | 'operator'
  | 'inline-image'
  | 'comment';

export interface Token {
  kind: TokenKind;
  text: string;
  start: number;
  end: number;
}

const WHITESPACE = new Set([' ', '\n', '\r', '\t', '\f', '\0']);
const DELIMITERS = new Set(['(', ')', '<', '>', '[', ']', '{', '}', '/', '%']);

function isWhitespace(char: string): boolean {
  return WHITESPACE.has(char);
}

function isRegular(char: string): boolean {
  return !isWhitespace(char) && !DELIMITERS.has(char);
}

function readLiteralString(source: string, from: number): number {
  let depth = 0;
  let index = from;
  while (index < source.length) {
    const char = source[index]!;
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
    index += 1;
  }
  return source.length;
}

function readInlineImage(source: string, from: number): number {
  let index = source.indexOf('ID', from);
  if (index < 0) return source.length;
  index += 2;
  while (index < source.length) {
    const at = source.indexOf('EI', index);
    if (at < 0) return source.length;
    const before = source[at - 1] ?? ' ';
    const after = source[at + 2] ?? ' ';
    if (isWhitespace(before) && (isWhitespace(after) || at + 2 >= source.length)) return at + 2;
    index = at + 2;
  }
  return source.length;
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index]!;

    if (isWhitespace(char)) {
      index += 1;
      continue;
    }

    if (char === '%') {
      const end = source.indexOf('\n', index);
      const stop = end < 0 ? source.length : end;
      tokens.push({ kind: 'comment', text: source.slice(index, stop), start: index, end: stop });
      index = stop;
      continue;
    }

    if (char === '(') {
      const end = readLiteralString(source, index);
      tokens.push({ kind: 'string', text: source.slice(index, end), start: index, end });
      index = end;
      continue;
    }

    if (char === '<' && source[index + 1] === '<') {
      tokens.push({ kind: 'open-dict', text: '<<', start: index, end: index + 2 });
      index += 2;
      continue;
    }

    if (char === '>' && source[index + 1] === '>') {
      tokens.push({ kind: 'close-dict', text: '>>', start: index, end: index + 2 });
      index += 2;
      continue;
    }

    if (char === '<') {
      const close = source.indexOf('>', index);
      const end = close < 0 ? source.length : close + 1;
      tokens.push({ kind: 'hex', text: source.slice(index, end), start: index, end });
      index = end;
      continue;
    }

    if (char === '[') {
      tokens.push({ kind: 'open-array', text: '[', start: index, end: index + 1 });
      index += 1;
      continue;
    }

    if (char === ']') {
      tokens.push({ kind: 'close-array', text: ']', start: index, end: index + 1 });
      index += 1;
      continue;
    }

    if (char === '/') {
      let end = index + 1;
      while (end < source.length && isRegular(source[end]!)) end += 1;
      tokens.push({ kind: 'name', text: source.slice(index, end), start: index, end });
      index = end;
      continue;
    }

    if (char === '{' || char === '}' || char === ')' || char === '>') {
      index += 1;
      continue;
    }

    let end = index;
    while (end < source.length && isRegular(source[end]!)) end += 1;
    if (end === index) end = index + 1;

    const text = source.slice(index, end);
    if (text === 'BI') {
      const stop = readInlineImage(source, end);
      tokens.push({ kind: 'inline-image', text: source.slice(index, stop), start: index, end: stop });
      index = stop;
      continue;
    }

    const kind: TokenKind = /^[+-]?(\d+\.?\d*|\.\d+)$/.test(text) ? 'number' : 'operator';
    tokens.push({ kind, text, start: index, end });
    index = end;
  }

  return tokens;
}

export function decodeLiteral(text: string): string {
  const body = text.slice(1, -1);
  let out = '';
  let index = 0;

  while (index < body.length) {
    const char = body[index]!;
    if (char !== '\\') {
      out += char;
      index += 1;
      continue;
    }

    const next = body[index + 1];
    if (next === undefined) break;

    const simple: Record<string, string> = {
      n: '\n',
      r: '\r',
      t: '\t',
      b: '\b',
      f: '\f',
      '(': '(',
      ')': ')',
      '\\': '\\',
    };

    if (simple[next] !== undefined) {
      out += simple[next];
      index += 2;
      continue;
    }

    if (next === '\n') {
      index += 2;
      continue;
    }

    const octal = /^[0-7]{1,3}/.exec(body.slice(index + 1));
    if (octal) {
      out += String.fromCharCode(Number.parseInt(octal[0], 8));
      index += 1 + octal[0].length;
      continue;
    }

    out += next;
    index += 2;
  }

  return out;
}

export function decodeHex(text: string): string {
  const body = text.slice(1, -1).replace(/[^0-9a-fA-F]/g, '');
  const even = body.length % 2 === 0 ? body : `${body}0`;
  let out = '';
  for (let index = 0; index + 1 < even.length; index += 2) {
    out += String.fromCharCode(Number.parseInt(even.slice(index, index + 2), 16));
  }
  return out;
}

export function decodeString(token: Token): string {
  if (token.kind === 'string') return decodeLiteral(token.text);
  if (token.kind === 'hex') return decodeHex(token.text);
  return '';
}

export function encodeLiteral(value: string): string {
  let out = '(';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (char === '(' || char === ')' || char === '\\') out += `\\${char}`;
    else if (code < 32 || code > 126) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += char;
  }
  return `${out})`;
}
