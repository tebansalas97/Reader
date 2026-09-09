<script lang="ts">
  import { t } from '$lib/i18n';
  import { nextZoomStep } from '$lib/pdf/render';
  import type { PdfDocument } from '$lib/state/documents.svelte';

  interface Props {
    doc: PdfDocument;
    effectiveScale: number;
    onpage: (page: number) => void;
    onzoom: (zoom: PdfDocument['zoom']) => void;
    onrotate: (rotation: PdfDocument['rotation']) => void;
  }

  const { doc, effectiveScale, onpage, onzoom, onrotate }: Props = $props();

  let pageInput = $state('');

  $effect(() => {
    pageInput = String(doc.page);
  });

  function commitPage(): void {
    const value = Number.parseInt(pageInput, 10);
    if (Number.isFinite(value)) onpage(value);
    else pageInput = String(doc.page);
  }

  function turn(direction: 1 | -1): void {
    const steps: PdfDocument['rotation'][] = [0, 90, 180, 270];
    const index = steps.indexOf(doc.rotation);
    onrotate(steps[(index + direction + 4) % 4]!);
  }
</script>

<div class="pdfbar" role="toolbar" aria-label={t('pdf.toolbar')}>
  <div class="group">
    <button
      class="tool"
      disabled={doc.page <= 1}
      title={t('pdf.previous')}
      aria-label={t('pdf.previous')}
      onclick={() => onpage(doc.page - 1)}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>
    </button>
    <input
      class="page"
      type="text"
      inputmode="numeric"
      bind:value={pageInput}
      aria-label={t('pdf.page')}
      onblur={commitPage}
      onkeydown={(e) => {
        if (e.key === 'Enter') commitPage();
      }}
    />
    <span class="total">/ {doc.pageCount}</span>
    <button
      class="tool"
      disabled={doc.page >= doc.pageCount}
      title={t('pdf.next')}
      aria-label={t('pdf.next')}
      onclick={() => onpage(doc.page + 1)}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg>
    </button>
  </div>

  <div class="sep"></div>

  <div class="group">
    <button
      class="tool"
      title={t('pdf.zoomOut')}
      aria-label={t('pdf.zoomOut')}
      onclick={() => onzoom(nextZoomStep(effectiveScale, -1))}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8h8" /></svg>
    </button>
    <span class="level">{Math.round(effectiveScale * 100)}%</span>
    <button
      class="tool"
      title={t('pdf.zoomIn')}
      aria-label={t('pdf.zoomIn')}
      onclick={() => onzoom(nextZoomStep(effectiveScale, 1))}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 4v8M4 8h8" /></svg>
    </button>
    <button
      class="text"
      class:on={doc.zoom === 'fit-width'}
      onclick={() => onzoom('fit-width')}
    >{t('pdf.fitWidth')}</button>
    <button
      class="text"
      class:on={doc.zoom === 'fit-page'}
      onclick={() => onzoom('fit-page')}
    >{t('pdf.fitPage')}</button>
  </div>

  <div class="sep"></div>

  <div class="group">
    <button
      class="tool"
      title={t('pdf.rotateLeft')}
      aria-label={t('pdf.rotateLeft')}
      onclick={() => turn(-1)}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 8a5 5 0 105-5H3.5" />
        <path d="M6 1L3 3.5 6 6" />
      </svg>
    </button>
    <button
      class="tool"
      title={t('pdf.rotateRight')}
      aria-label={t('pdf.rotateRight')}
      onclick={() => turn(1)}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M13 8a5 5 0 11-5-5h4.5" />
        <path d="M10 1l3 2.5L10 6" />
      </svg>
    </button>
  </div>

  <div class="grow"></div>

  {#if doc.encrypted}
    <span class="warn">{t('status.encrypted')}</span>
  {/if}
</div>

<style>
  .pdfbar {
    display: flex;
    align-items: center;
    gap: 2px;
    min-height: 36px;
    padding: 4px 8px;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .pdfbar::-webkit-scrollbar {
    display: none;
  }

  .group {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .grow {
    flex: 1;
    min-width: 8px;
  }

  .sep {
    width: 1px;
    height: 18px;
    margin: 0 5px;
    background: var(--border);
    flex-shrink: 0;
  }

  .tool {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 26px;
    border-radius: 5px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .tool:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text);
  }

  .tool:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .tool svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.35;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .text {
    height: 26px;
    padding: 0 8px;
    border-radius: 5px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .text:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .text.on {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .page {
    width: 44px;
    height: 24px;
    padding: 0 4px;
    text-align: center;
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: 5px;
    outline: none;
    font-variant-numeric: tabular-nums;
  }

  .page:focus {
    border-color: var(--accent);
  }

  .total,
  .level {
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .level {
    min-width: 46px;
    text-align: center;
  }

  .warn {
    color: var(--warning);
    white-space: nowrap;
  }
</style>
