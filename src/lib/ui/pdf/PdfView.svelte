<script lang="ts">
  import { t } from '$lib/i18n';
  import { openPdfDocument, PdfOpenError, type PdfHandle } from '$lib/pdf/document';
  import { scaleFor } from '$lib/pdf/render';
  import { offsetOfPage, visibleRange } from '$lib/pdf/virtual';
  import {
    anchoredOffset,
    contentWidth,
    pageHeights,
    tallestPage,
    wheelZoom,
    widestPage,
  } from '$lib/pdf/zoom';
  import { documents, type PdfDocument } from '$lib/state/documents.svelte';
  import PdfPage from './PdfPage.svelte';

  interface Props {
    docId: string;
    onready?: (handle: PdfHandle) => void;
    onfailed?: (message: string) => void;
    onscale?: (scale: number) => void;
  }

  const { docId, onready, onfailed, onscale }: Props = $props();

  const GAP = 16;
  const PADDING = 24;

  let scroller = $state<HTMLElement | null>(null);
  let handle = $state<PdfHandle | null>(null);
  let viewportWidth = $state(0);
  let viewportHeight = $state(0);
  let scrollTop = $state(0);
  let loading = $state(true);
  let programmatic = false;
  let lastScale = 0;

  const doc = $derived(documents.pdfById(docId));
  const sizes = $derived(handle?.pageSizes ?? []);
  const rotation = $derived(doc?.rotation ?? 0);
  const zoom = $derived(doc?.zoom ?? 'fit-width');

  const fitSize = $derived(
    zoom === 'fit-page' ? tallestPage(sizes, rotation) : widestPage(sizes, rotation),
  );

  const scale = $derived(
    fitSize === null
      ? 1
      : scaleFor(
          fitSize,
          zoom,
          { width: viewportWidth, height: viewportHeight },
          rotation,
          PADDING,
        ),
  );

  const heights = $derived(pageHeights(sizes, scale, rotation));
  const range = $derived(visibleRange(heights, scrollTop - PADDING, viewportHeight, 2, GAP));
  const stripWidth = $derived(
    Math.max(viewportWidth, contentWidth(sizes, scale, rotation) + PADDING * 2),
  );

  $effect(() => {
    onscale?.(scale);
  });

  $effect(() => {
    const url = doc?.assetUrl;
    if (!url) return;
    let cancelled = false;
    loading = true;

    void (async () => {
      try {
        const opened = await openPdfDocument(url);
        if (cancelled) {
          await opened.destroy();
          return;
        }
        handle = opened;
        loading = false;
        onready?.(opened);
      } catch (error) {
        if (cancelled) return;
        loading = false;
        const reason = error instanceof PdfOpenError ? error.reason : 'unknown';
        onfailed?.(t(`pdf.error.${reason}`));
      }
    })();

    return () => {
      cancelled = true;
      void handle?.destroy().catch(() => undefined);
      handle = null;
    };
  });

  $effect(() => {
    const node = scroller;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      viewportWidth = node.clientWidth;
      viewportHeight = node.clientHeight;
    });
    observer.observe(node);
    viewportWidth = node.clientWidth;
    viewportHeight = node.clientHeight;
    return () => observer.disconnect();
  });

  $effect(() => {
    const next = scale;
    const node = scroller;
    const ready = sizes.length > 0 && viewportWidth > 0;
    if (!node || !ready) {
      lastScale = 0;
      return;
    }
    if (next === lastScale) return;
    const previous = lastScale;
    lastScale = next;
    if (previous === 0) return;
    programmatic = true;
    const top = anchoredOffset(node.scrollTop, node.clientHeight / 2, previous, next);
    const left = anchoredOffset(node.scrollLeft, node.clientWidth / 2, previous, next);
    requestAnimationFrame(() => {
      node.scrollTop = top;
      node.scrollLeft = left;
      programmatic = false;
      scrollTop = node.scrollTop;
    });
  });

  $effect(() => {
    const page = doc?.page ?? 1;
    const node = scroller;
    if (!node || heights.length === 0) return;
    const target = offsetOfPage(heights, page - 1, GAP) + PADDING;
    if (Math.abs(node.scrollTop - target) < 4) return;
    programmatic = true;
    node.scrollTop = target;
    requestAnimationFrame(() => {
      programmatic = false;
    });
  });

  function onScroll(): void {
    const node = scroller;
    if (!node) return;
    scrollTop = node.scrollTop;
    if (programmatic || heights.length === 0) return;
    const first = visibleRange(heights, node.scrollTop - PADDING, node.clientHeight, 0, GAP).first;
    if (doc && first + 1 !== doc.page) documents.setPage(docId, first + 1);
  }

  function onWheel(event: WheelEvent): void {
    if (!event.ctrlKey || !doc) return;
    event.preventDefault();
    const next = wheelZoom(scale, event.deltaY);
    if (next === scale) return;
    const node = scroller;
    if (node) {
      const box = node.getBoundingClientRect();
      const left = anchoredOffset(node.scrollLeft, event.clientX - box.left, scale, next);
      const top = anchoredOffset(node.scrollTop, event.clientY - box.top, scale, next);
      programmatic = true;
      lastScale = next;
      requestAnimationFrame(() => {
        node.scrollLeft = left;
        node.scrollTop = top;
        programmatic = false;
        scrollTop = node.scrollTop;
      });
    }
    documents.setZoom(docId, next);
  }

  export function setZoomMode(mode: PdfDocument['zoom']): void {
    documents.setZoom(docId, mode);
  }

  export function currentScale(): number {
    return scale;
  }

  export function pdfHandle(): PdfHandle | null {
    return handle;
  }
</script>

<div class="viewer" bind:this={scroller} onscroll={onScroll} onwheel={onWheel}>
  {#if loading}
    <p class="note">{t('pdf.loading')}</p>
  {:else if handle}
    <div class="pages" style="gap: {GAP}px; padding: {PADDING}px; width: {stripWidth}px">
      {#each sizes as size, index (index)}
        <PdfPage
          {index}
          {size}
          {scale}
          {rotation}
          live={index >= range.renderFirst && index <= range.renderLast}
          getPage={(n) => handle!.page(n)}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .viewer {
    height: 100%;
    overflow: auto;
    background: var(--bg-inset);
    overscroll-behavior: contain;
  }

  .pages {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100%;
    box-sizing: border-box;
  }

  .note {
    margin: 0;
    padding: 24px;
    text-align: center;
    color: var(--text-faint);
  }
</style>
