import { slugify } from './pipeline';

export interface OutlineItem {
  level: number;
  text: string;
  line: number;
  id: string;
}

const FENCE = /^\s{0,3}(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

function stripInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim();
}

export function extractOutline(text: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  const used = new Map<string, number>();
  let inFence = false;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = HEADING.exec(line);
    if (!m) continue;
    const level = m[1]!.length;
    const heading = stripInline(m[2]!);
    const base = slugify(heading) || 'seccion';
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    items.push({ level, text: heading, line: i, id: seen === 0 ? base : `${base}-${seen}` });
  }
  return items;
}

export function activeOutlineIndex(items: OutlineItem[], line: number): number {
  if (items.length === 0) return -1;
  let index = 0;
  for (let i = 0; i < items.length; i += 1) {
    if (items[i]!.line <= line) index = i;
    else break;
  }
  return index;
}
