import { writeText } from '$lib/fs/api';
import { resolveRelative } from '$lib/fs/paths';
import { renderMarkdown } from '$lib/preview/render';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface StandaloneOptions {
  title: string;
  bodyHtml: string;
  css: string;
  theme: 'light' | 'dark';
}

export function buildStandaloneHtml(options: StandaloneOptions): string {
  return [
    '<!doctype html>',
    `<html lang="es" data-theme="${options.theme}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(options.title)}</title>`,
    `<style>${options.css}</style>`,
    '</head>',
    '<body class="markdown-body">',
    options.bodyHtml,
    '</body>',
    '</html>',
  ].join('\n');
}

export function collectStyles(): string {
  const chunks: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) chunks.push(rule.cssText);
    } catch {
      continue;
    }
  }
  return chunks.join('\n');
}

async function fileToDataUri(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function inlineImages(html: string, docPath: string | null): Promise<string> {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  const images = Array.from(holder.querySelectorAll('img'));
  if (images.length === 0) return html;
  const { convertFileSrc } = await import('@tauri-apps/api/core');
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src') ?? '';
      if (src.length === 0 || src.startsWith('data:')) return;
      const url = /^(https?:|http:\/\/asset\.localhost)/i.test(src)
        ? src
        : convertFileSrc(docPath ? resolveRelative(docPath, src) : src);
      const data = await fileToDataUri(url);
      if (data) img.setAttribute('src', data);
      img.removeAttribute('data-resolved');
    }),
  );
  return holder.innerHTML;
}

export interface ExportSource {
  title: string;
  text: string;
  path: string | null;
}

export async function exportHtml(
  doc: ExportSource,
  targetPath: string,
  theme: 'light' | 'dark',
  liveHtml?: string,
): Promise<void> {
  const rendered = liveHtml ?? renderMarkdown(doc.text);
  const bodyHtml = await inlineImages(rendered, doc.path);
  const html = buildStandaloneHtml({
    title: doc.title,
    bodyHtml,
    css: collectStyles(),
    theme,
  });
  await writeText(targetPath, html, 'lf');
}
