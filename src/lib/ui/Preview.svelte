<script lang="ts">
  import { t } from '$lib/i18n';
  import {
    activeBlockElement,
    clearHighlight,
    clearSelectionMark,
    codeTextOf,
    decorateCodeBlocks,
    decorateDiagrams,
    diagramSvgOf,
    highlightBlock,
    lineOfBlock,
    markSelection,
  } from '$lib/preview/decorations';
  import { enhance } from '$lib/preview/lazy';
  import { grantAssetDirs, retryBroken } from '$lib/preview/assets';
  import { annotateLinks, handlePreviewClick, rewriteAssets } from '$lib/preview/links';
  import { patchPreview } from '$lib/preview/patch';
  import { renderMarkdown } from '$lib/preview/render';
  import {
    buildLineMap,
    createGestureTracker,
    lineForPreviewTop,
    previewTopForLine,
    type LineAnchor,
  } from '$lib/preview/scroll-sync';
  import { documents } from '$lib/state/documents.svelte';
  import { prefs, resolvedTheme } from '$lib/state/prefs.svelte';
  import { ui } from '$lib/state/ui.svelte';

  interface Props {
    docId: string;
    activeBlock?: { start: number; end: number } | null;
    fragment?: string;
    onopen: (path: string) => void;
    onscrollline?: (line: number) => void;
    onpicksource?: (line: number) => void;
    oncopy?: (ok: boolean) => void;
    ondiagram?: (svg: string) => void;
    ontask?: (line: number) => void;
  }

  const {
    docId,
    activeBlock,
    fragment,
    onopen,
    onscrollline,
    onpicksource,
    oncopy,
    ondiagram,
    ontask,
  }: Props = $props();

  const DEBOUNCE_THRESHOLD = 200 * 1024;

  let scroller = $state<HTMLElement | null>(null);
  let content = $state<HTMLElement | null>(null);
  let anchors: LineAnchor[] = [];
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const gesture = createGestureTracker();

  function decorate(node: HTMLElement, path: string | null): void {
    decorateCodeBlocks(node, t('preview.copy'));
    decorateDiagrams(node, t('preview.expand'));
    annotateLinks(node, path, {
      external: t('link.external'),
      document: t('link.document'),
      section: t('link.section'),
      unknownSection: t('link.unknownSection'),
    });
  }

  function paintHighlight(node: HTMLElement): void {
    clearSelectionMark(node);
    if (!prefs.current.highlightActiveBlock || !activeBlock) {
      clearHighlight(node);
      return;
    }
    highlightBlock(node, activeBlock.start, activeBlock.end);
    const block = activeBlockElement(node);
    if (block && fragment && fragment.trim().length > 0) markSelection(block, fragment);
  }

  function apply(text: string, path: string | null, theme: 'light' | 'dark'): void {
    const node = content;
    if (!node) return;
    patchPreview(node, renderMarkdown(text));
    const folders = rewriteAssets(node, path);
    void grantAssetDirs(folders).then((fresh) => {
      if (fresh && content) retryBroken(content);
    });
    decorate(node, path);
    paintHighlight(node);
    anchors = buildLineMap(node);
    void enhance(node, text, theme).then(() => {
      if (!content) return;
      decorate(content, path);
      paintHighlight(content);
      anchors = buildLineMap(content);
    });
  }

  function schedule(text: string, path: string | null, theme: 'light' | 'dark'): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    cancelAnimationFrame(frame);
    if (text.length > DEBOUNCE_THRESHOLD) {
      timer = setTimeout(() => apply(text, path, theme), 80);
      return;
    }
    frame = requestAnimationFrame(() => apply(text, path, theme));
  }

  async function copyCode(pre: HTMLElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(codeTextOf(pre));
      oncopy?.(true);
    } catch {
      oncopy?.(false);
    }
  }

  function onContentClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      const item = target.closest<HTMLElement>('li[data-line]');
      const line = item ? Number(item.dataset.line) : Number.NaN;
      if (Number.isFinite(line)) {
        ontask?.(line);
      } else {
        target.checked = !target.checked;
      }
      return;
    }

    const action = target.closest<HTMLElement>('[data-action]');
    if (action) {
      event.preventDefault();
      event.stopPropagation();
      const pre = action.closest('pre');
      if (!pre) return;
      if (action.dataset.action === 'copy-code') {
        void copyCode(pre);
        return;
      }
      const svg = diagramSvgOf(pre);
      if (svg) ondiagram?.(svg);
      return;
    }

    if (target.closest('a')) {
      handlePreviewClick(event, documents.markdownById(docId)?.path ?? null, onopen);
      return;
    }

    const diagram = target.closest<HTMLElement>('pre.mermaid[data-rendered]');
    if (diagram) {
      event.preventDefault();
      const svg = diagramSvgOf(diagram);
      if (svg) ondiagram?.(svg);
      return;
    }

    if (event.detail >= 2) {
      const line = lineOfBlock(target);
      if (line !== null) onpicksource?.(line);
    }
  }

  $effect(() => {
    const doc = documents.markdownById(docId);
    if (!doc || doc.previewDisabled || !content) return;
    schedule(doc.text, doc.path, resolvedTheme());
  });

  $effect(() => {
    const node = content;
    void activeBlock;
    void fragment;
    void prefs.current.highlightActiveBlock;
    if (node) paintHighlight(node);
  });

  $effect(() => {
    const node = content;
    const outer = scroller;
    if (!node || !outer) return;
    const onClick = (event: MouseEvent) => onContentClick(event);
    const note = () => gesture.note();
    node.addEventListener('click', onClick);
    outer.addEventListener('pointerdown', note);
    outer.addEventListener('keydown', note);
    return () => {
      node.removeEventListener('click', onClick);
      outer.removeEventListener('pointerdown', note);
      outer.removeEventListener('keydown', note);
    };
  });

  $effect(() => {
    return () => {
      if (timer) clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  });

  export function scrollToLine(line: number): void {
    if (scroller) scroller.scrollTop = previewTopForLine(anchors, line);
  }

  export function topLine(): number {
    if (!scroller) return 0;
    return lineForPreviewTop(anchors, scroller.scrollTop);
  }

  export function revealBlock(line: number): void {
    const outer = scroller;
    if (!outer) return;
    const target = previewTopForLine(anchors, line);
    if (target < outer.scrollTop || target > outer.scrollTop + outer.clientHeight - 80) {
      outer.scrollTop = Math.max(0, target - outer.clientHeight / 3);
    }
  }

  export function html(): string {
    return content?.innerHTML ?? '';
  }

  function onScroll(): void {
    if (!gesture.isRecent()) return;
    onscrollline?.(topLine());
  }

  const disabled = $derived(documents.markdownById(docId)?.previewDisabled ?? false);
</script>

<div
  class="preview"
  class:reading={ui.viewMode === 'preview'}
  bind:this={scroller}
  onscroll={onScroll}
  onwheel={gesture.note}
  style="--preview-font: {prefs.current.previewFont}; --preview-size: {prefs.current
    .previewFontSize}px; --preview-width: {prefs.current.previewWidth}px"
>
  {#if disabled}
    <p class="disabled">{t('error.tooLarge')}</p>
  {/if}
  <div class="content markdown-body" bind:this={content}></div>
</div>

<style>
  .preview {
    height: 100%;
    overflow: auto;
    background: var(--bg);
    user-select: text;
  }

  .content {
    font-family: var(--preview-font);
    font-size: var(--preview-size);
    line-height: 1.7;
    padding: 24px 32px 40vh;
  }

  .preview.reading .content {
    max-width: var(--preview-width);
    margin: 0 auto;
    padding: 56px 24px 40vh;
  }

  .disabled {
    margin: 0;
    padding: 12px 32px;
    color: var(--warning);
    background: var(--bg-inset);
    border-bottom: 1px solid var(--border);
  }
</style>
