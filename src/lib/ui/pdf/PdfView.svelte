<script lang="ts">
  import { t } from '$lib/i18n';
  import { openPdfDocument, PdfOpenError, type PdfHandle } from '$lib/pdf/document';
  import { scaleFor } from '$lib/pdf/render';
  import { offsetOfPage, visibleRange } from '$lib/pdf/virtual';
  import { documents } from '$lib/state/documents.svelte';
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

  const doc = $derived(documents.pdfById(docId));
  const sizes = $derived(handle?.pageSizes ?? []);

  const scale = $derived(
    sizes.length === 0
      ? 1
      : scaleFor(
          sizes[0]!,
          doc?.zoom ?? 'fit-width',
          { width: viewportWidth, height: viewportHeight },
          doc?.rotation ?? 0,
          PADDING,
        ),
  );

  const heights = $derived(
    sizes.map((size) => {
      const turned = ((((size.rotation + (doc?.rotation ?? 0)) % 360) + 360) % 360) % 180 === 90;
      const height = turned ? size.width : size.height;
      return height * scale;
    }),
  );

  const range = $derived(visibleRange(heights, scrollTop, viewportHeight, 2, GAP));

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
    const page = doc?.page ?? 1;
    const node = scroller;
    if (!node || heights.length === 0) return;
    const target = offsetOfPage(heights, page - 1, GAP);
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
    const first = visibleRange(heights, node.scrollTop, node.clientHeight, 0, GAP).first;
    if (doc && first + 1 !== doc.page) documents.setPage(docId, first + 1);
  }

  export function goToPage(page: number): void {
    documents.setPage(docId, page);
  }

  export function pdfHandle(): PdfHandle | null {
    return handle;
  }
</script>

<div class="viewer" bind:this={scroller} onscroll={onScroll}>
  {#if loading}
    <p class="note">{t('pdf.loading')}</p>
  {:else if handle}
    <div class="pages" style="gap: {GAP}px; padding: {PADDING}px">
      {#each sizes as size, index (index)}
        <PdfPage
          {index}
          {size}
          {scale}
          rotation={doc?.rotation ?? 0}
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
  }

  .pages {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100%;
  }

  .note {
    margin: 0;
    padding: 24px;
    text-align: center;
    color: var(--text-faint);
  }
</style>
