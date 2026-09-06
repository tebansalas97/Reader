import { convertFileSrc } from '@tauri-apps/api/core';
import { openExternal } from '$lib/fs/api';
import { isExternalUrl, isMarkdown, resolveRelative } from '$lib/fs/paths';

function isEmbedded(src: string): boolean {
  return /^(https?:|data:|blob:|asset:)/i.test(src) || src.startsWith('http://asset.localhost');
}

export function rewriteAssets(root: HTMLElement, docPath: string | null): void {
  if (docPath === null) return;
  for (const img of Array.from(root.querySelectorAll('img'))) {
    if (img.hasAttribute('data-resolved')) continue;
    const src = img.getAttribute('src') ?? '';
    if (src.length === 0 || isEmbedded(src)) continue;
    img.setAttribute('src', convertFileSrc(resolveRelative(docPath, src)));
    img.setAttribute('data-resolved', '1');
  }
}

export function handlePreviewClick(
  event: MouseEvent,
  docPath: string | null,
  openDoc: (path: string) => void,
): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest('a');
  if (!anchor) return;
  const href = anchor.getAttribute('href') ?? '';
  if (href.length === 0) return;
  event.preventDefault();
  if (href.startsWith('#')) {
    const id = decodeURIComponent(href.slice(1));
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (isExternalUrl(href)) {
    void openExternal(href).catch(() => undefined);
    return;
  }
  if (docPath !== null && isMarkdown(href)) {
    openDoc(resolveRelative(docPath, href));
  }
}
