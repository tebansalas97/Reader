export interface CodeMap {
  toText: Map<number, string>;
  toCode: Map<string, number>;
}

function hexValue(text: string): number {
  return Number.parseInt(text, 16);
}

function utf16From(hex: string): string {
  let out = '';
  for (let index = 0; index + 3 < hex.length + 1; index += 4) {
    const piece = hex.slice(index, index + 4);
    if (piece.length < 4) break;
    out += String.fromCharCode(hexValue(piece));
  }
  return out;
}

export function parseToUnicode(source: string): Map<number, string> {
  const map = new Map<number, string>();

  const chars = /beginbfchar([\s\S]*?)endbfchar/g;
  let found = chars.exec(source);
  while (found) {
    const pairs = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g;
    let pair = pairs.exec(found[1]!);
    while (pair) {
      const text = utf16From(pair[2]!);
      if (text !== '') map.set(hexValue(pair[1]!), text);
      pair = pairs.exec(found[1]!);
    }
    found = chars.exec(source);
  }

  const ranges = /beginbfrange([\s\S]*?)endbfrange/g;
  let range = ranges.exec(source);
  while (range) {
    const body = range[1]!;

    const simple = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
    let entry = simple.exec(body);
    while (entry) {
      const from = hexValue(entry[1]!);
      const to = hexValue(entry[2]!);
      const start = hexValue(entry[3]!.slice(-4));
      const prefix = entry[3]!.length > 4 ? utf16From(entry[3]!.slice(0, -4)) : '';
      if (to - from < 65536) {
        for (let code = from; code <= to; code += 1) {
          map.set(code, prefix + String.fromCharCode(start + (code - from)));
        }
      }
      entry = simple.exec(body);
    }

    const listed = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([\s\S]*?)\]/g;
    let group = listed.exec(body);
    while (group) {
      const from = hexValue(group[1]!);
      const items = group[3]!.match(/<([0-9a-fA-F]*)>/g) ?? [];
      items.forEach((item, offset) => {
        const text = utf16From(item.slice(1, -1));
        if (text !== '') map.set(from + offset, text);
      });
      group = listed.exec(body);
    }

    range = ranges.exec(source);
  }

  return map;
}

export function reverseCodes(map: Map<number, string>): Map<string, number> {
  const back = new Map<string, number>();
  for (const [code, text] of map) {
    if (text.length === 0) continue;
    if (!back.has(text)) back.set(text, code);
  }
  return back;
}

export function codeMapOf(source: string): CodeMap {
  const toText = parseToUnicode(source);
  return { toText, toCode: reverseCodes(toText) };
}

export function parseWideWidths(entries: Array<number | number[]>): Map<number, number> {
  const widths = new Map<number, number>();
  let index = 0;
  while (index < entries.length) {
    const first = entries[index];
    const second = entries[index + 1];
    if (typeof first !== 'number') break;

    if (Array.isArray(second)) {
      second.forEach((width, offset) => {
        if (typeof width === 'number') widths.set(first + offset, width);
      });
      index += 2;
      continue;
    }

    const third = entries[index + 2];
    if (typeof second === 'number' && typeof third === 'number') {
      if (second - first < 65536) {
        for (let code = first; code <= second; code += 1) widths.set(code, third);
      }
      index += 3;
      continue;
    }

    break;
  }
  return widths;
}

export function codesOfWide(bytes: string): number[] {
  const codes: number[] = [];
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    codes.push((bytes.charCodeAt(index) << 8) | bytes.charCodeAt(index + 1));
  }
  return codes;
}

export function bytesOfWide(codes: number[]): string {
  let out = '';
  for (const code of codes) out += String.fromCharCode((code >> 8) & 0xff, code & 0xff);
  return out;
}
