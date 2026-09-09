<script lang="ts">
  import type { PDFPageProxy } from 'pdfjs-dist';
  import type { Annotation } from '$lib/pdf/annotations/model';
  import type { PageSize } from '$lib/pdf/document';
  import { canvasSize, createPageRenderer, releaseCanvas } from '$lib/pdf/render';
  import {
    piecesFrom,
    scaleXFor,
    styleFor,
    transformOf,
    type TextPiece,
  } from '$lib/pdf/text-layer';
  import type { AnnotationTool } from '$lib/state/ui.svelte';
  import AnnotationLayer from './AnnotationLayer.svelte';

  interface Props {
    index: number;
    size: PageSize;
    scale: number;
    rotation: number;
    live: boolean;
    getPage: (index: number) => Promise<PDFPageProxy>;
    onfailed?: (index: number) => void;
    annotations?: Annotation[];
    tool?: AnnotationTool;
    color?: string;
    author?: string;
    selectedId?: string | null;
    oncreate?: (annotation: Annotation) => void;
    onselect?: (id: string | null) => void;
    onchange?: (annotation: Annotation) => void;
  }

  const {
    index,
    size,
    scale,
    rotation,
    live,
    getPage,
    onfailed,
    annotations = [],
    tool = 'none',
    color = '#ffd400',
    author = '',
    selectedId = null,
    oncreate,
    onselect,
    onchange,
  }: Props = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let failed = $state(false);
  let drawn = $state(false);
  let pieces = $state<TextPiece[]>([]);
  const spans: Array<HTMLElement | null> = [];

  const box = $derived(canvasSize(size, scale, rotation, globalThis.devicePixelRatio ?? 1));

  $effect(() => {
    const drawnPieces = pieces;
    if (drawnPieces.length === 0) return;
    const nodes = spans.slice(0, drawnPieces.length);
    const widths = nodes.map((node) => node?.offsetWidth ?? 0);
    nodes.forEach((node, i) => {
      if (!node) return;
      const stretch = scaleXFor(drawnPieces[i]!.width, widths[i]!);
      node.style.transform = transformOf(drawnPieces[i]!, stretch);
    });
  });

  $effect(() => {
    const node = canvas;
    const currentScale = scale;
    const currentRotation = rotation;
    const currentSize = size;
    const currentIndex = index;
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
        spans.length = 0;
        pieces = piecesFrom(content.items, currentSize, currentScale, currentRotation);
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
        <span bind:this={spans[i]} style={styleFor(piece)}>{piece.text}</span>
      {/each}
    </div>
  {/if}
  {#if live}
    <AnnotationLayer
      page={index + 1}
      {size}
      {scale}
      {rotation}
      {annotations}
      {tool}
      {color}
      {author}
      {selectedId}
      oncreate={(annotation) => oncreate?.(annotation)}
      onselect={(id) => onselect?.(id)}
      onchange={(annotation) => onchange?.(annotation)}
    />
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
