export interface PdfMatch {
  page: number;
  index: number;
  text: string;
}

export interface PdfSearchOutcome {
  matches: PdfMatch[];
  truncated: boolean;
}

const MAX_MATCHES = 500;
const CONTEXT = 40;

export function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export function excerpt(text: string, index: number, length: number): string {
  const start = Math.max(0, index - CONTEXT);
  const end = Math.min(text.length, index + length + CONTEXT);
  const body = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '… ' : ''}${body}${end < text.length ? ' …' : ''}`;
}

export function findInPages(pages: string[], query: string): PdfSearchOutcome {
  const needle = fold(query.trim());
  if (needle.length === 0) return { matches: [], truncated: false };

  const matches: PdfMatch[] = [];
  for (let page = 0; page < pages.length; page += 1) {
    const raw = pages[page] ?? '';
    const haystack = fold(raw);
    let from = 0;
    for (;;) {
      const index = haystack.indexOf(needle, from);
      if (index < 0) break;
      if (matches.length >= MAX_MATCHES) return { matches, truncated: true };
      matches.push({ page: page + 1, index, text: excerpt(raw, index, needle.length) });
      from = index + needle.length;
    }
  }
  return { matches, truncated: false };
}

export function groupByPage(matches: PdfMatch[]): Array<{ page: number; items: PdfMatch[] }> {
  const groups: Array<{ page: number; items: PdfMatch[] }> = [];
  for (const match of matches) {
    const last = groups[groups.length - 1];
    if (last && last.page === match.page) last.items.push(match);
    else groups.push({ page: match.page, items: [match] });
  }
  return groups;
}

export interface TextSource {
  pageCount: number;
  page(index: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }>;
}

function itemText(item: unknown): string {
  const value = (item as { str?: unknown }).str;
  return typeof value === 'string' ? value : '';
}

function hasEol(item: unknown): boolean {
  return (item as { hasEOL?: boolean }).hasEOL === true;
}

export function joinTextItems(items: unknown[]): string {
  let text = '';
  for (const item of items) {
    text += itemText(item);
    if (hasEol(item)) text += '\n';
  }
  return text;
}

export interface ItemRange {
  item: number;
  from: number;
  to: number;
}

export function itemRanges(items: unknown[]): ItemRange[] {
  const ranges: ItemRange[] = [];
  let at = 0;
  for (let index = 0; index < items.length; index += 1) {
    const text = itemText(items[index]);
    const from = at;
    at += text.length;
    if (hasEol(items[index])) at += 1;
    if (text.length > 0) ranges.push({ item: index, from, to: at });
  }
  return ranges;
}

export function itemsForMatch(ranges: ItemRange[], index: number, length: number): number[] {
  const end = index + Math.max(1, length);
  return ranges
    .filter((range) => range.from < end && range.to > index)
    .map((range) => range.item);
}

export async function extractPageText(source: TextSource, page: number): Promise<string> {
  const proxy = await source.page(page);
  const content = await proxy.getTextContent();
  return joinTextItems(content.items);
}

export async function extractAllText(
  source: TextSource,
  cache: Map<number, string>,
): Promise<string[]> {
  const pages: string[] = [];
  for (let page = 1; page <= source.pageCount; page += 1) {
    const known = cache.get(page);
    if (known !== undefined) {
      pages.push(known);
      continue;
    }
    const text = await extractPageText(source, page);
    cache.set(page, text);
    pages.push(text);
  }
  return pages;
}
