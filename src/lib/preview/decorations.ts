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
    if (line >= startLine || best === null || line <= startLine) best = node;
    if (line >= startLine && line <= endLine) {
      best = node;
      break;
    }
  }
  for (const node of Array.from(root.querySelectorAll('.is-active-block'))) {
    if (node !== best) node.classList.remove('is-active-block');
  }
  best?.classList.add('is-active-block');
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
