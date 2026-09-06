<script lang="ts">
  import { t } from '$lib/i18n';
  import { enhance } from '$lib/preview/lazy';
  import { handlePreviewClick, rewriteAssets } from '$lib/preview/links';
  import { patchPreview } from '$lib/preview/patch';
  import { renderMarkdown } from '$lib/preview/render';
  import {
    buildLineMap,
    lineForPreviewTop,
    previewTopForLine,
    type LineAnchor,
  } from '$lib/preview/scroll-sync';
  import { documents } from '$lib/state/documents.svelte';
  import { prefs, resolvedTheme } from '$lib/state/prefs.svelte';
  import { ui } from '$lib/state/ui.svelte';

  interface Props {
    docId: string;
    onopen: (path: string) => void;
    onscrollline?: (line: number) => void;
  }

  const { docId, onopen, onscrollline }: Props = $props();

  const DEBOUNCE_THRESHOLD = 200 * 1024;

  let scroller = $state<HTMLElement | null>(null);
  let content = $state<HTMLElement | null>(null);
  let anchors: LineAnchor[] = [];
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function apply(text: string, path: string | null, theme: 'light' | 'dark'): void {
    const node = content;
    if (!node) return;
    patchPreview(node, renderMarkdown(text));
    rewriteAssets(node, path);
    anchors = buildLineMap(node);
    void enhance(node, text, theme).then(() => {
      if (content) anchors = buildLineMap(content);
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

  $effect(() => {
    const doc = documents.byId(docId);
    if (!doc || doc.previewDisabled || !content) return;
    schedule(doc.text, doc.path, resolvedTheme());
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

  export function html(): string {
    return content?.innerHTML ?? '';
  }

  function onScroll(): void {
    onscrollline?.(topLine());
  }

  const disabled = $derived(documents.byId(docId)?.previewDisabled ?? false);
</script>

<div
  class="preview"
  class:reading={ui.viewMode === 'preview'}
  bind:this={scroller}
  onscroll={onScroll}
  style="--preview-font: {prefs.current.previewFont}; --preview-size: {prefs.current
    .previewFontSize}px; --preview-width: {prefs.current.previewWidth}px"
>
  {#if disabled}
    <p class="disabled">{t('error.tooLarge')}</p>
  {/if}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="content markdown-body"
    bind:this={content}
    onclick={(event) => handlePreviewClick(event, documents.byId(docId)?.path ?? null, onopen)}
  ></div>
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
