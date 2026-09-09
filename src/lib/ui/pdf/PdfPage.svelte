<script lang="ts">
  import type { PDFPageProxy } from 'pdfjs-dist';
  import type { PageSize } from '$lib/pdf/document';
  import { canvasSize, createPageRenderer, releaseCanvas } from '$lib/pdf/render';

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

  const box = $derived(canvasSize(size, scale, rotation, globalThis.devicePixelRatio ?? 1));

  $effect(() => {
    const node = canvas;
    if (!node) return;
    if (!live) {
      releaseCanvas(node);
      return;
    }

    const renderer = createPageRenderer(node);
    let cancelled = false;

    void (async () => {
      try {
        const page = await getPage(index + 1);
        if (cancelled) return;
        await renderer.render(page, scale, rotation);
        if (!cancelled) failed = false;
      } catch {
        if (cancelled) return;
        failed = true;
        onfailed?.(index);
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
  {#if !live || failed}
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
  }
</style>
