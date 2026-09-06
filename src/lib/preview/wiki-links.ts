import type MarkdownIt from 'markdown-it';

const WIKI = /\[\[([^\]|\n]+?)(?:\|([^\]\n]+?))?\]\]/;

export interface WikiTarget {
  target: string;
  label: string;
}

export function parseWikiLink(source: string): WikiTarget | null {
  const match = WIKI.exec(source);
  if (!match) return null;
  const target = match[1]!.trim();
  if (target.length === 0) return null;
  return { target, label: (match[2] ?? match[1]!).trim() };
}

export function wikiTargetToFile(target: string): string {
  const clean = target.replace(/\\/g, '/').trim();
  return /\.(md|markdown|txt)$/i.test(clean) ? clean : `${clean}.md`;
}

export function wikiLinkPlugin(md: InstanceType<typeof MarkdownIt>): void {
  md.inline.ruler.before('link', 'wiki_link', (state, silent) => {
    const source = state.src;
    const start = state.pos;
    if (source.charCodeAt(start) !== 0x5b || source.charCodeAt(start + 1) !== 0x5b) return false;
    const closing = source.indexOf(']]', start + 2);
    if (closing < 0) return false;
    const inner = source.slice(start + 2, closing);
    if (inner.includes('\n') || inner.length === 0) return false;
    const parsed = parseWikiLink(`[[${inner}]]`);
    if (!parsed) return false;

    if (!silent) {
      const open = state.push('link_open', 'a', 1);
      open.attrSet('href', wikiTargetToFile(parsed.target));
      open.attrSet('class', 'wiki-link');
      const text = state.push('text', '', 0);
      text.content = parsed.label;
      state.push('link_close', 'a', -1);
    }
    state.pos = closing + 2;
    return true;
  });
}

export function wikiCandidates(names: string[], query: string): string[] {
  const needle = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
  const scored = names
    .map((name) => {
      const plain = name
        .replace(/\.(md|markdown|txt)$/i, '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
      if (needle.length === 0) return { name, score: 1 };
      const index = plain.indexOf(needle);
      if (index === 0) return { name, score: 1000 };
      if (index > 0) return { name, score: 500 - index };
      return { name, score: 0 };
    })
    .filter((entry) => entry.score > 0);
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored.map((entry) => entry.name).slice(0, 12);
}
