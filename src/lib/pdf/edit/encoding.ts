const WIN_ANSI_HIGH: Record<number, string> = {
  128: '€',
  130: '‚',
  131: 'ƒ',
  132: '„',
  133: '…',
  134: '†',
  135: '‡',
  136: 'ˆ',
  137: '‰',
  138: 'Š',
  139: '‹',
  140: 'Œ',
  142: 'Ž',
  145: '‘',
  146: '’',
  147: '“',
  148: '”',
  149: '•',
  150: '–',
  151: '—',
  152: '˜',
  153: '™',
  154: 'š',
  155: '›',
  156: 'œ',
  158: 'ž',
  159: 'Ÿ',
};

export type EncodingName = 'WinAnsiEncoding' | 'StandardEncoding' | 'unknown';

export function encodingNameOf(value: string | null): EncodingName {
  if (value === 'WinAnsiEncoding') return 'WinAnsiEncoding';
  if (value === 'StandardEncoding' || value === null) return 'StandardEncoding';
  return 'unknown';
}

export function tableFor(encoding: EncodingName): Map<number, string> {
  const table = new Map<number, string>();
  for (let code = 32; code <= 126; code += 1) table.set(code, String.fromCharCode(code));

  if (encoding === 'WinAnsiEncoding') {
    for (const [code, char] of Object.entries(WIN_ANSI_HIGH)) table.set(Number(code), char);
    for (let code = 160; code <= 255; code += 1) table.set(code, String.fromCharCode(code));
  }

  return table;
}

export function reverseTable(table: Map<number, string>): Map<string, number> {
  const back = new Map<string, number>();
  for (const [code, char] of table) {
    if (!back.has(char)) back.set(char, code);
  }
  return back;
}

export function decodeBytes(bytes: string, table: Map<number, string>): string {
  let out = '';
  for (const char of bytes) out += table.get(char.charCodeAt(0)) ?? '�';
  return out;
}

export interface EncodedText {
  bytes: string;
  missing: string[];
}

export function encodeText(value: string, back: Map<string, number>): EncodedText {
  let bytes = '';
  const missing: string[] = [];
  for (const char of value) {
    const code = back.get(char);
    if (code === undefined) {
      if (!missing.includes(char)) missing.push(char);
      continue;
    }
    bytes += String.fromCharCode(code);
  }
  return { bytes, missing };
}
