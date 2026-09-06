import DOMPurify from 'dompurify';
import { createMarkdown } from './pipeline';

const md = createMarkdown();

const PURIFY_CONFIG = {
  ADD_ATTR: ['data-line', 'data-rendered', 'data-source', 'target', 'rel', 'align', 'checked'],
  ADD_TAGS: [
    'svg',
    'path',
    'g',
    'foreignObject',
    'marker',
    'defs',
    'text',
    'tspan',
    'line',
    'rect',
    'circle',
    'ellipse',
    'polygon',
    'polyline',
  ],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'style'],
  ALLOW_DATA_ATTR: true,
};

let hooked = false;

function ensureHook(): void {
  if (hooked) return;
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName !== 'input') return;
    const el = node as Element;
    const isTaskCheckbox =
      el.getAttribute?.('type') === 'checkbox' && el.hasAttribute?.('disabled');
    if (!isTaskCheckbox) el.remove?.();
  });
  hooked = true;
}

export function sanitize(html: string): string {
  ensureHook();
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}

export function renderMarkdown(text: string): string {
  if (text.length === 0) return '';
  return sanitize(md.render(text));
}
