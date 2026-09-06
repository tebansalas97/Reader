type Highlighter = typeof import('highlight.js/lib/core').default;
type Katex = typeof import('katex').default;
type Mermaid = typeof import('mermaid').default;

let highlighter: Promise<Highlighter> | null = null;
let katexLib: Promise<Katex> | null = null;
let mermaidLib: Promise<Mermaid> | null = null;
let mermaidTheme: 'light' | 'dark' | null = null;
let mermaidCounter = 0;

const LANGUAGE_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  javascript: () => import('highlight.js/lib/languages/javascript'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  json: () => import('highlight.js/lib/languages/json'),
  css: () => import('highlight.js/lib/languages/css'),
  scss: () => import('highlight.js/lib/languages/scss'),
  xml: () => import('highlight.js/lib/languages/xml'),
  bash: () => import('highlight.js/lib/languages/bash'),
  python: () => import('highlight.js/lib/languages/python'),
  rust: () => import('highlight.js/lib/languages/rust'),
  go: () => import('highlight.js/lib/languages/go'),
  java: () => import('highlight.js/lib/languages/java'),
  kotlin: () => import('highlight.js/lib/languages/kotlin'),
  swift: () => import('highlight.js/lib/languages/swift'),
  csharp: () => import('highlight.js/lib/languages/csharp'),
  cpp: () => import('highlight.js/lib/languages/cpp'),
  c: () => import('highlight.js/lib/languages/c'),
  php: () => import('highlight.js/lib/languages/php'),
  ruby: () => import('highlight.js/lib/languages/ruby'),
  sql: () => import('highlight.js/lib/languages/sql'),
  yaml: () => import('highlight.js/lib/languages/yaml'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  ini: () => import('highlight.js/lib/languages/ini'),
  diff: () => import('highlight.js/lib/languages/diff'),
  dockerfile: () => import('highlight.js/lib/languages/dockerfile'),
  powershell: () => import('highlight.js/lib/languages/powershell'),
};

const ALIASES: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  html: 'xml',
  svelte: 'xml',
  vue: 'xml',
  svg: 'xml',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  py: 'python',
  rs: 'rust',
  golang: 'go',
  cs: 'csharp',
  'c++': 'cpp',
  yml: 'yaml',
  md: 'markdown',
  toml: 'ini',
  ps1: 'powershell',
  docker: 'dockerfile',
};

const registered = new Set<string>();

export function resetLazyCaches(): void {
  highlighter = null;
  katexLib = null;
  mermaidLib = null;
  mermaidTheme = null;
  registered.clear();
}

function languageOf(el: Element): string | null {
  const cls = Array.from(el.classList).find((c) => c.startsWith('language-'));
  if (!cls) return null;
  const raw = cls.slice('language-'.length).toLowerCase();
  return ALIASES[raw] ?? raw;
}

export function needsHighlight(root: HTMLElement): boolean {
  return Array.from(root.querySelectorAll('pre > code[class*="language-"]')).some((el) => {
    const lang = languageOf(el);
    return lang !== null && lang !== 'mermaid' && !el.hasAttribute('data-rendered');
  });
}

export function needsMath(text: string): boolean {
  const stripped = text.replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '');
  if (/\$\$[\s\S]+?\$\$/.test(stripped)) return true;
  return /(?<!\$)\$(?!\s)[^$\n]+?(?<![\s\\])\$(?!\$)/.test(stripped);
}

export function needsMermaid(root: HTMLElement): boolean {
  return root.querySelector('pre > code.language-mermaid:not([data-rendered])') !== null;
}

async function applyHighlight(root: HTMLElement): Promise<void> {
  if (!highlighter) {
    highlighter = import('highlight.js/lib/core').then((m) => m.default);
    void import('highlight.js/styles/github-dark.css');
  }
  const hljs = await highlighter;
  for (const block of Array.from(root.querySelectorAll('pre > code[class*="language-"]'))) {
    const lang = languageOf(block);
    if (!lang || lang === 'mermaid' || block.hasAttribute('data-rendered')) continue;
    const loader = LANGUAGE_LOADERS[lang];
    if (!loader) continue;
    if (!registered.has(lang)) {
      const mod = await loader();
      hljs.registerLanguage(lang, mod.default as never);
      registered.add(lang);
    }
    const result = hljs.highlight(block.textContent ?? '', { language: lang, ignoreIllegals: true });
    block.innerHTML = result.value;
    block.setAttribute('data-rendered', '1');
  }
}

async function applyMath(root: HTMLElement): Promise<void> {
  if (!katexLib) {
    katexLib = import('katex').then((m) => m.default);
    void import('katex/dist/katex.min.css');
  }
  const katex = await katexLib;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest('pre, code, .katex')) return NodeFilter.FILTER_REJECT;
      return /\$/.test(node.nodeValue ?? '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const targets: Text[] = [];
  while (walker.nextNode()) targets.push(walker.currentNode as Text);
  for (const node of targets) {
    const source = node.nodeValue ?? '';
    const fragment = document.createDocumentFragment();
    const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
    let cursor = 0;
    let match: RegExpExecArray | null = pattern.exec(source);
    while (match !== null) {
      fragment.append(source.slice(cursor, match.index));
      const span = document.createElement('span');
      const expression = match[1] ?? match[2] ?? '';
      try {
        katex.render(expression, span, {
          displayMode: match[1] !== undefined,
          throwOnError: false,
          output: 'html',
        });
      } catch {
        span.textContent = match[0];
        span.className = 'math-error';
      }
      fragment.append(span);
      cursor = match.index + match[0].length;
      match = pattern.exec(source);
    }
    if (cursor === 0) continue;
    fragment.append(source.slice(cursor));
    node.replaceWith(fragment);
  }
}

async function applyMermaid(root: HTMLElement, theme: 'light' | 'dark'): Promise<void> {
  if (!mermaidLib) {
    mermaidLib = import('mermaid').then((m) => m.default);
  }
  const mermaid = await mermaidLib;
  if (mermaidTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'strict',
      fontFamily: 'inherit',
    });
    mermaidTheme = theme;
  }
  for (const block of Array.from(
    root.querySelectorAll('pre > code.language-mermaid:not([data-rendered])'),
  )) {
    const pre = block.parentElement;
    if (!pre) continue;
    const source = block.textContent ?? '';
    mermaidCounter += 1;
    try {
      const { svg } = await mermaid.render(`reader-mermaid-${mermaidCounter}`, source);
      pre.className = 'mermaid';
      pre.innerHTML = svg;
      pre.setAttribute('data-rendered', '1');
      pre.setAttribute('data-source', source);
    } catch (error) {
      pre.classList.add('mermaid-error');
      pre.setAttribute('data-rendered', '1');
      block.setAttribute('data-rendered', '1');
      const message = document.createElement('div');
      message.className = 'mermaid-message';
      message.textContent = error instanceof Error ? error.message : String(error);
      pre.append(message);
    }
  }
}

export async function enhance(
  root: HTMLElement,
  text: string,
  theme: 'light' | 'dark',
): Promise<void> {
  const jobs: Promise<void>[] = [];
  if (needsHighlight(root)) jobs.push(applyHighlight(root));
  if (needsMath(text)) jobs.push(applyMath(root));
  if (needsMermaid(root)) jobs.push(applyMermaid(root, theme));
  if (jobs.length === 0) return;
  await Promise.allSettled(jobs);
}
