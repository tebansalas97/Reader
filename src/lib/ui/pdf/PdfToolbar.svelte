<script lang="ts">
  import { t } from '$lib/i18n';
  import type { AnnotationKind } from '$lib/pdf/annotations/model';
  import { PALETTE } from '$lib/pdf/annotations/palette';
  import { nextZoomStep } from '$lib/pdf/render';
  import type { PdfDocument } from '$lib/state/documents.svelte';
  import type { AnnotationTool } from '$lib/state/ui.svelte';

  interface Props {
    doc: PdfDocument;
    effectiveScale: number;
    tool: AnnotationTool;
    color: string;
    onpage: (page: number) => void;
    onzoom: (zoom: PdfDocument['zoom']) => void;
    onrotate: (rotation: PdfDocument['rotation']) => void;
    ontool: (tool: AnnotationTool) => void;
    oncolor: (color: string) => void;
    onsignature: () => void;
  }

  const {
    doc,
    effectiveScale,
    tool,
    color,
    onpage,
    onzoom,
    onrotate,
    ontool,
    oncolor,
    onsignature,
  }: Props = $props();

  const TOOLS: Array<{ kind: AnnotationKind; path: string }> = [
    { kind: 'highlight', path: 'M3 12h10v2H3zM5 3h6l1 7H4z' },
    { kind: 'underline', path: 'M5 2v5a3 3 0 006 0V2M4 14h8' },
    { kind: 'strikeout', path: 'M5 3v4a3 3 0 006 0V3M3 8h10M8 10v3' },
    { kind: 'ink', path: 'M3 13c3 1 4-6 7-6s2 4 3 4' },
    { kind: 'note', path: 'M3 3h10v7H7l-3 3v-3H3z' },
    { kind: 'rect', path: 'M3 4h10v8H3z' },
    { kind: 'ellipse', path: 'M8 4c3 0 5 1.8 5 4s-2 4-5 4-5-1.8-5-4 2-4 5-4z' },
  ];

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

  <div class="sep"></div>

  <div class="group">
    {#each TOOLS as entry (entry.kind)}
      <button
        class="tool"
        class:on={tool === entry.kind}
        title={t(`pdf.tool.${entry.kind}`)}
        aria-label={t(`pdf.tool.${entry.kind}`)}
        aria-pressed={tool === entry.kind}
        onclick={() => ontool(entry.kind)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d={entry.path} /></svg>
      </button>
    {/each}
  </div>

  <button
    class="tool"
    class:on={tool === 'text'}
    title={t('pdf.editText')}
    aria-label={t('pdf.editText')}
    aria-pressed={tool === 'text'}
    onclick={() => ontool('text')}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 4V3h8v1M7 3v10M5.5 13h3" />
      <path d="M11 11.5l3-3 1.2 1.2-3 3-1.5.3z" />
    </svg>
  </button>

  <button
    class="tool"
    class:on={tool === 'signature'}
    title={t('pdf.tool.signature')}
    aria-label={t('pdf.tool.signature')}
    aria-pressed={tool === 'signature'}
    onclick={onsignature}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 12c2 .6 3-5 5-5s1 3 2.5 3S12 6 13 5" />
      <path d="M2 14.5h12" />
    </svg>
  </button>

  {#if tool !== 'none' && tool !== 'signature'}
    <div class="group colors" aria-label={t('pdf.color')}>
      {#each PALETTE as swatch (swatch)}
        <button
          class="swatch"
          class:on={swatch.toLowerCase() === color.toLowerCase()}
          style="--swatch: {swatch}"
          title={swatch}
          aria-label={swatch}
          onclick={() => oncolor(swatch)}
        ></button>
      {/each}
    </div>
  {/if}

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

  .tool.on {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .colors {
    gap: 3px;
    margin-left: 6px;
  }

  .swatch {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--swatch);
    border: 2px solid transparent;
    flex-shrink: 0;
  }

  .swatch.on {
    border-color: var(--text);
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
