<script lang="ts">
  import type { PDFPageProxy } from 'pdfjs-dist';
  import type { Annotation, Rect as PdfRect } from '$lib/pdf/annotations/model';
  import type { PageSize } from '$lib/pdf/document';
  import { canvasSize, createPageRenderer, releaseCanvas } from '$lib/pdf/render';
  import {
    piecesFrom,
    scaleXFor,
    styleFor,
    transformOf,
    type TextPiece,
  } from '$lib/pdf/text-layer';
  import type { FieldValues, FormField } from '$lib/pdf/forms/model';
  import type { StampItem } from '$lib/state/stamps.svelte';
  import type { TextEdit } from '$lib/pdf/edit/document';
  import type { AnnotationTool } from '$lib/state/ui.svelte';
  import AnnotationLayer from './AnnotationLayer.svelte';
  import TextEditLayer from './TextEditLayer.svelte';
  import FormLayer from './FormLayer.svelte';

  interface Props {
    index: number;
    page: number;
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
    selectedIds?: string[];
    stamp?: StampItem | null;
    oncreate?: (annotation: Annotation) => void;
    onselect?: (id: string, additive: boolean) => void;
    onredact?: (page: number, rect: PdfRect) => void;
    onchange?: (annotation: Annotation) => void;
    fields?: FormField[];
    values?: FieldValues;
    onvalue?: (name: string, value: string) => void;
    edits?: TextEdit[];
    flash?: number[];
    night?: boolean;
    picking?: boolean;
    onpick?: (piece: TextPiece) => void;
    onunedit?: (id: string) => void;
  }

  const {
    index,
    page,
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
    selectedIds = [],
    stamp = null,
    oncreate,
    onselect,
    onredact,
    onchange,
    fields = [],
    values = {},
    onvalue,
    edits = [],
    flash = [],
    night = false,
    picking = false,
    onpick,
    onunedit,
  }: Props = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let failed = $state(false);
  let drawn = $state(false);
  let pieces = $state<TextPiece[]>([]);
  const spans: Array<HTMLElement | null> = [];

  const box = $derived(canvasSize(size, scale, rotation, globalThis.devicePixelRatio ?? 1));
  const lit = $derived(
    flash.length === 0 ? [] : pieces.filter((piece) => flash.includes(piece.item)),
  );

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
        await renderer.render(page, currentScale, currentSize.rotation + currentRotation);
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
  data-page={page}
  style="width: {box.cssWidth}px; height: {box.cssHeight}px"
>
  <canvas bind:this={canvas} class:night aria-label="Página {index + 1}"></canvas>
  {#if live && pieces.length > 0}
    <div class="text-layer" class:picking>
      {#each pieces as piece, i (i)}
        <span
          bind:this={spans[i]}
          style={styleFor(piece)}
          role={picking ? 'button' : undefined}
          tabindex={picking ? -1 : undefined}
          onpointerdown={(event) => {
            if (!picking) return;
            event.stopPropagation();
            event.preventDefault();
            onpick?.(piece);
          }}
        >{piece.text}</span>
      {/each}
    </div>
  {/if}
  {#if lit.length > 0}
    <div class="flash">
      {#each lit as piece, i (i)}
        <span
          style="left: {piece.left}px; top: {piece.top}px; width: {Math.max(
            piece.width,
            4,
          )}px; height: {piece.height}px"
        ></span>
      {/each}
    </div>
  {/if}
  {#if live && edits.length > 0}
    <TextEditLayer {size} {scale} {rotation} {edits} onremove={(id) => onunedit?.(id)} />
  {/if}
  {#if live && fields.length > 0}
    <FormLayer
      {size}
      {scale}
      {rotation}
      {fields}
      {values}
      onvalue={(name, value) => onvalue?.(name, value)}
    />
  {/if}
  {#if live}
    <AnnotationLayer
      {page}
      {size}
      {scale}
      {rotation}
      {annotations}
      {tool}
      {color}
      {author}
      {selectedIds}
      {stamp}
      oncreate={(annotation) => oncreate?.(annotation)}
      onredact={(rect) => onredact?.(page, rect)}
      onselect={(id, additive) => onselect?.(id, additive)}
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

  canvas.night {
    filter: invert(1) hue-rotate(180deg);
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

  .text-layer.picking span {
    cursor: pointer;
    background: rgba(64, 120, 240, 0.14);
  }

  .text-layer.picking span:hover {
    background: rgba(64, 120, 240, 0.3);
  }

  .text-layer span::selection {
    background: rgba(64, 120, 240, 0.35);
  }

  .flash {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .flash span {
    position: absolute;
    background: rgba(255, 196, 0, 0.45);
    outline: 1px solid rgba(220, 150, 0, 0.9);
    border-radius: 1px;
    animation: fade 2.4s ease-out forwards;
  }

  @keyframes fade {
    0%,
    60% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
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
