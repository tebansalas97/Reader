const COPY_MARK = 'data-copy-ready';
const ZOOM_MARK = 'data-zoom-ready';

export function decorateCodeBlocks(root: HTMLElement, label: string): void {
  for (const pre of Array.from(root.querySelectorAll('pre'))) {
    if (pre.classList.contains('mermaid') || pre.classList.contains('mermaid-error')) continue;
    if (pre.hasAttribute(COPY_MARK)) continue;
    pre.setAttribute(COPY_MARK, '1');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy';
    button.textContent = label;
    button.setAttribute('aria-label', label);
    button.dataset.action = 'copy-code';
    pre.append(button);
  }
}

export function decorateDiagrams(root: HTMLElement, label: string): void {
  for (const pre of Array.from(root.querySelectorAll('pre.mermaid'))) {
    if (pre.hasAttribute(ZOOM_MARK)) continue;
    pre.setAttribute(ZOOM_MARK, '1');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'diagram-zoom';
    button.textContent = label;
    button.setAttribute('aria-label', label);
    button.dataset.action = 'zoom-diagram';
    pre.append(button);
  }
}

export function codeTextOf(pre: HTMLElement): string {
  const code = pre.querySelector('code');
  const source = code ?? pre;
  const clone = source.cloneNode(true) as HTMLElement;
  for (const button of Array.from(clone.querySelectorAll('button'))) button.remove();
  return (clone.textContent ?? '').replace(/\n+$/, '');
}

export function diagramSvgOf(pre: HTMLElement): string | null {
  const svg = pre.querySelector('svg');
  if (!svg) return null;
  const clone = svg.cloneNode(true) as SVGElement;
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return clone.outerHTML;
}

export function highlightBlock(root: HTMLElement, startLine: number, endLine: number): void {
  let best: HTMLElement | null = null;
  for (const node of Array.from(root.querySelectorAll<HTMLElement>('[data-line]'))) {
    const line = Number(node.dataset.line);
    if (!Number.isFinite(line)) continue;
    if (line > endLine) break;
    if (line <= startLine || (line >= startLine && line <= endLine)) best = node;
  }
  for (const node of Array.from(root.querySelectorAll('.is-active-block'))) {
    if (node !== best) node.classList.remove('is-active-block');
  }
  best?.classList.add('is-active-block');
}

export function activeBlockElement(root: HTMLElement): HTMLElement | null {
  return root.querySelector('.is-active-block');
}

export function clearHighlight(root: HTMLElement): void {
  for (const node of Array.from(root.querySelectorAll('.is-active-block'))) {
    node.classList.remove('is-active-block');
  }
}

export function lineOfBlock(target: Element): number | null {
  const block = target.closest<HTMLElement>('[data-line]');
  if (!block) return null;
  const line = Number(block.dataset.line);
  return Number.isFinite(line) ? line : null;
}

const SELECTION_CLASS = 'is-selected-text';

export function plainFragment(source: string): string {
  return source
    .replace(/^[ ]*(?:[-*+]|\d+[.)])[ ]+(?:\[[ xX]\][ ]+)?/gm, '')
    .replace(/^[ ]{0,3}#{1,6}[ ]+/gm, '')
    .replace(/^[ ]{0,3}>[ ]?/gm, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function clearSelectionMark(root: HTMLElement): void {
  for (const mark of Array.from(root.querySelectorAll(`mark.${SELECTION_CLASS}`))) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }
}

interface TextSpan {
  node: Text;
  start: number;
  end: number;
}

function textSpans(block: HTMLElement): { spans: TextSpan[]; text: string } {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (parent?.closest('button')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const spans: TextSpan[] = [];
  let text = '';
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const value = node.nodeValue ?? '';
    if (value.length === 0) continue;
    spans.push({ node, start: text.length, end: text.length + value.length });
    text += value;
  }
  return { spans, text };
}

function escapeForSearch(value: string): string {
  return value.replace(/[.*+?^${}()|\[\]\\]/g, '\\$&');
}

function flexiblePattern(needle: string): RegExp {
  const parts = needle
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map(escapeForSearch);
  return new RegExp(parts.join('\\s+'));
}

export function markSelection(block: HTMLElement, fragment: string): boolean {
  clearSelectionMark(block);
  const needle = plainFragment(fragment);
  if (needle.length < 2) return false;

  const { spans, text } = textSpans(block);
  if (spans.length === 0) return false;

  const match = flexiblePattern(needle).exec(text);
  if (!match) return false;

  const from = match.index;
  const to = from + match[0].length;
  const startSpan = spans.find((s) => from >= s.start && from < s.end);
  const endSpan = spans.find((s) => to > s.start && to <= s.end);
  if (!startSpan || !endSpan) return false;

  const range = document.createRange();
  range.setStart(startSpan.node, from - startSpan.start);
  range.setEnd(endSpan.node, to - endSpan.start);

  const mark = document.createElement('mark');
  mark.className = SELECTION_CLASS;
  try {
    range.surroundContents(mark);
  } catch {
    mark.append(range.extractContents());
    range.insertNode(mark);
  }
  return true;
}
