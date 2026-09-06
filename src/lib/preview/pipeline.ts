import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function addLineNumbers(md: MarkdownIt): void {
  const original = md.renderer.renderToken.bind(md.renderer);
  md.renderer.renderToken = (tokens, idx, options) => {
    const token = tokens[idx];
    if (token && token.nesting !== -1 && token.map && token.level === 0) {
      token.attrSet('data-line', String(token.map[0]));
    }
    return original(tokens, idx, options);
  };
}

export function createMarkdown(): MarkdownIt {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    breaks: false,
  });
  md.use(taskLists, { enabled: false, label: true });
  md.use(footnote);
  md.use(anchor, { slugify, permalink: false, tabIndex: false });
  addLineNumbers(md);
  return md;
}
