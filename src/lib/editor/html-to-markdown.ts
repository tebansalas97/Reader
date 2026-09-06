const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'SECTION',
  'ARTICLE',
  'HEADER',
  'FOOTER',
  'MAIN',
  'ASIDE',
  'FIGURE',
  'FIGCAPTION',
]);

function textOf(node: Node): string {
  return (node.textContent ?? '').replace(/\s+/g, ' ');
}

function inline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.nodeValue ?? '').replace(/\s+/g, ' ');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  const inner = Array.from(el.childNodes).map(inline).join('');
  switch (el.tagName) {
    case 'STRONG':
    case 'B':
      return inner.trim().length === 0 ? inner : `**${inner.trim()}**`;
    case 'EM':
    case 'I':
      return inner.trim().length === 0 ? inner : `*${inner.trim()}*`;
    case 'DEL':
    case 'S':
    case 'STRIKE':
      return inner.trim().length === 0 ? inner : `~~${inner.trim()}~~`;
    case 'CODE':
      return `\`${textOf(el).trim()}\``;
    case 'A': {
      const href = el.getAttribute('href') ?? '';
      const label = inner.trim();
      if (href.length === 0) return label;
      return label.length === 0 ? href : `[${label}](${href})`;
    }
    case 'IMG': {
      const src = el.getAttribute('src') ?? '';
      const alt = el.getAttribute('alt') ?? '';
      return src.length === 0 ? '' : `![${alt}](${src})`;
    }
    case 'BR':
      return '\n';
    default:
      return inner;
  }
}

function listToMarkdown(list: HTMLElement, depth: number): string {
  const ordered = list.tagName === 'OL';
  const indent = '  '.repeat(depth);
  const lines: string[] = [];
  let index = 1;
  for (const item of Array.from(list.children)) {
    if (item.tagName !== 'LI') continue;
    const nested: string[] = [];
    const own: Node[] = [];
    for (const child of Array.from(item.childNodes)) {
      const tag = (child as HTMLElement).tagName;
      if (tag === 'UL' || tag === 'OL') nested.push(listToMarkdown(child as HTMLElement, depth + 1));
      else own.push(child);
    }
    const body = own.map(inline).join('').trim();
    const marker = ordered ? `${index}.` : '-';
    lines.push(`${indent}${marker} ${body}`);
    lines.push(...nested);
    index += 1;
  }
  return lines.join('\n');
}

function tableToMarkdown(table: HTMLElement): string {
  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length === 0) return '';
  const cells = rows.map((row) =>
    Array.from(row.children).map((cell) =>
      Array.from(cell.childNodes).map(inline).join('').trim().replace(/\|/g, '\\|'),
    ),
  );
  const width = Math.max(...cells.map((r) => r.length));
  const pad = (row: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => row[i] ?? '').join(' | ')} |`;
  const header = cells[0] ?? [];
  const divider = `| ${Array.from({ length: width }, () => '---').join(' | ')} |`;
  return [pad(header), divider, ...cells.slice(1).map(pad)].join('\n');
}

function block(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const value = (node.nodeValue ?? '').replace(/\s+/g, ' ').trim();
    return value;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  switch (el.tagName) {
    case 'SCRIPT':
    case 'STYLE':
    case 'NOSCRIPT':
      return '';
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6': {
      const level = Number(el.tagName.slice(1));
      const body = Array.from(el.childNodes).map(inline).join('').trim();
      return body.length === 0 ? '' : `${'#'.repeat(level)} ${body}`;
    }
    case 'UL':
    case 'OL':
      return listToMarkdown(el, 0);
    case 'TABLE':
      return tableToMarkdown(el);
    case 'PRE': {
      const code = el.querySelector('code');
      const language =
        Array.from(code?.classList ?? [])
          .find((c) => c.startsWith('language-'))
          ?.slice('language-'.length) ?? '';
      const body = (el.textContent ?? '').replace(/\n+$/, '');
      return `\`\`\`${language}\n${body}\n\`\`\``;
    }
    case 'BLOCKQUOTE': {
      const inner = Array.from(el.childNodes).map(block).filter(Boolean).join('\n\n');
      return inner
        .split('\n')
        .map((l) => `> ${l}`.trimEnd())
        .join('\n');
    }
    case 'HR':
      return '---';
    case 'BR':
      return '';
    default:
      break;
  }
  if (BLOCK_TAGS.has(el.tagName)) {
    const hasBlockChild = Array.from(el.children).some(
      (c) => BLOCK_TAGS.has(c.tagName) || /^(H[1-6]|UL|OL|PRE|TABLE|BLOCKQUOTE|HR)$/.test(c.tagName),
    );
    if (hasBlockChild) {
      return Array.from(el.childNodes).map(block).filter(Boolean).join('\n\n');
    }
    const body = Array.from(el.childNodes).map(inline).join('').trim();
    return body;
  }
  return Array.from(el.childNodes).map(inline).join('').trim();
}

export function htmlToMarkdown(html: string): string {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  const blocks = Array.from(holder.childNodes).map(block).filter((b) => b.trim().length > 0);
  return blocks
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function looksLikeRichHtml(html: string): boolean {
  return /<(h[1-6]|ul|ol|li|table|pre|blockquote|strong|em|b|i|a|code|p)\b/i.test(html);
}
