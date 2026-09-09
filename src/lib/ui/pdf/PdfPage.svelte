<script lang="ts">
  import type { PDFPageProxy } from 'pdfjs-dist';
  import type { PageSize } from '$lib/pdf/document';
  import { canvasSize, createPageRenderer, releaseCanvas } from '$lib/pdf/render';
  import { piecesFrom, styleFor, type TextPiece } from '$lib/pdf/text-layer';

  interface Props {
    index: number;
    size: PageSize;
    scale: number;
    rotation: number;
    live: boolean;
    getPage: (index: number) => Promise<PDFPageProxy>;
    onfailed?: (index: number) => void;
  }

  const { index, size, scale, rotation, live, getPage, onfailed }: Props = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let failed = $state(false);
  let drawn = $state(false);
  let pieces = $state<TextPiece[]>([]);

  const box = $derived(canvasSize(size, scale, rotation, globalThis.devicePixelRatio ?? 1));

  $effect(() => {
    const node = canvas;
    const currentScale = scale;
    const currentRotation = rotation;
    const currentIndex = index;
    const height = box.cssHeight;
    const isLive = live;

    if (!node) return;
    if (!isLive) {
      releaseCanvas(node);
      pieces = [];
      drawn = false;
      return;
    }

    const renderer = createPageRenderer(node);
    let cancelled = false;

    void (async () => {
      try {
        const page = await getPage(currentIndex + 1);
        if (cancelled) return;
        await renderer.render(page, currentScale, currentRotation);
        if (cancelled) return;
        failed = false;
        drawn = true;
        const content = await page.getTextContent();
        if (cancelled) return;
        pieces = piecesFrom(content.items, height, currentScale);
      } catch {
        if (cancelled) return;
        failed = true;
        drawn = false;
        onfailed?.(currentIndex);
      }
    })();

    return () => {
      cancelled = true;
      renderer.cancel();
    };
  });
</script>

<div
  class="page"
  class:live
  data-page={index + 1}
  style="width: {box.cssWidth}px; height: {box.cssHeight}px"
>
  <canvas bind:this={canvas} aria-label="Página {index + 1}"></canvas>
  {#if live && pieces.length > 0}
    <div class="text-layer">
      {#each pieces as piece, i (i)}
        <span style={styleFor(piece)}>{piece.text}</span>
      {/each}
    </div>
  {/if}
  {#if !drawn || failed}
    <div class="placeholder">
      <span>{index + 1}</span>
    </div>
  {/if}
</div>

<style>
  .page {
    position: relative;
    flex-shrink: 0;
    background: #ffffff;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.28);
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .text-layer {
    position: absolute;
    inset: 0;
    overflow: hidden;
    line-height: 1;
    user-select: text;
    cursor: text;
  }

  .text-layer span {
    position: absolute;
    white-space: pre;
    transform-origin: 0 0;
    color: transparent;
  }

  .text-layer span::selection {
    background: rgba(64, 120, 240, 0.35);
  }

  .placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-inset);
    color: var(--text-faint);
    font-size: 24px;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }
</style>
