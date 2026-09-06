export interface LineAnchor {
  line: number;
  top: number;
  height: number;
}

export function buildLineMap(root: HTMLElement): LineAnchor[] {
  const anchors = Array.from(root.querySelectorAll<HTMLElement>('[data-line]'))
    .map((el) => ({
      line: Number(el.dataset.line),
      top: el.offsetTop,
      height: el.offsetHeight,
    }))
    .filter((a) => Number.isFinite(a.line));
  anchors.sort((a, b) => a.line - b.line);
  return anchors;
}

function indexAtLine(map: LineAnchor[], line: number): number {
  let index = 0;
  for (let i = 0; i < map.length; i += 1) {
    if (map[i]!.line <= line) index = i;
    else break;
  }
  return index;
}

export function previewTopForLine(map: LineAnchor[], line: number): number {
  if (map.length === 0) return 0;
  const index = indexAtLine(map, line);
  const current = map[index]!;
  const next = map[index + 1];
  if (line <= current.line || !next) return current.top;
  const span = next.line - current.line;
  if (span <= 0) return current.top;
  const ratio = Math.min(1, (line - current.line) / span);
  return current.top + ratio * (next.top - current.top);
}

export function lineForPreviewTop(map: LineAnchor[], top: number): number {
  if (map.length === 0) return 0;
  if (top <= map[0]!.top) return map[0]!.line;
  let index = 0;
  for (let i = 0; i < map.length; i += 1) {
    if (map[i]!.top <= top) index = i;
    else break;
  }
  const current = map[index]!;
  const next = map[index + 1];
  if (!next) return current.line;
  const span = next.top - current.top;
  if (span <= 0) return current.line;
  const ratio = (top - current.top) / span;
  return Math.round(current.line + ratio * (next.line - current.line));
}

export interface SyncGuard {
  claim(owner: 'editor' | 'preview'): boolean;
  release(): void;
}

export function createSyncGuard(quietMs = 120): SyncGuard {
  let owner: 'editor' | 'preview' | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function release(): void {
    owner = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    claim(next) {
      if (owner !== null && owner !== next) return false;
      owner = next;
      if (timer) clearTimeout(timer);
      timer = setTimeout(release, quietMs);
      return true;
    },
    release,
  };
}
