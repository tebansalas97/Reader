<script lang="ts">
  import { INK_WIDTH, NOTE_SIZE } from '$lib/pdf/annotations/appearance';
  import { toPdfPoint, toPdfRect } from '$lib/pdf/annotations/geometry';
  import type { Annotation, Point } from '$lib/pdf/annotations/model';
  import { hitBox, paintAnnotation } from '$lib/pdf/annotations/paint';
  import {
    bigEnough,
    createAnnotation,
    dragRect,
    simplify,
  } from '$lib/pdf/annotations/selection';
  import type { PageSize } from '$lib/pdf/document';
  import { rotatedSize } from '$lib/pdf/render';
  import type { AnnotationTool } from '$lib/state/ui.svelte';

  interface Props {
    page: number;
    size: PageSize;
    scale: number;
    rotation: number;
    annotations: Annotation[];
    tool: AnnotationTool;
    color: string;
    author: string;
    selectedId: string | null;
    oncreate: (annotation: Annotation) => void;
    onselect: (id: string | null) => void;
  }

  const {
    page,
    size,
    scale,
    rotation,
    annotations,
    tool,
    color,
    author,
    selectedId,
    oncreate,
    onselect,
  }: Props = $props();

  let root = $state<SVGSVGElement | null>(null);
  let stroke = $state<Point[]>([]);
  let start = $state<Point | null>(null);
  let end = $state<Point | null>(null);

  const box = $derived(rotatedSize(size, rotation));
  const width = $derived(Math.max(1, Math.round(box.width * scale)));
  const height = $derived(Math.max(1, Math.round(box.height * scale)));

  const draws = $derived(tool === 'ink' || tool === 'rect' || tool === 'ellipse' || tool === 'note');
  const painted = $derived(
    annotations.map((annotation) => ({
      annotation,
      shape: paintAnnotation(annotation, size, scale, rotation),
    })),
  );
  const hits = $derived(
    annotations
      .map((annotation) => ({ annotation, box: hitBox(annotation, size, scale, rotation) }))
      .filter((entry) => entry.box !== null),
  );
  const preview = $derived(start && end ? dragRect(start, end) : null);
  const inkPreview = $derived(
    stroke.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '),
  );

  function pointOf(event: PointerEvent): Point {
    const node = root;
    if (!node) return { x: 0, y: 0 };
    const rect = node.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function capture(event: PointerEvent, on: boolean): void {
    try {
      if (on) root?.setPointerCapture(event.pointerId);
      else root?.releasePointerCapture(event.pointerId);
    } catch {
      return;
    }
  }

  function finish(): void {
    stroke = [];
    start = null;
    end = null;
  }

  function emit(annotation: Annotation | null): void {
    if (annotation) oncreate(annotation);
  }

  function onPointerDown(event: PointerEvent): void {
    if (!draws || event.button !== 0) return;
    event.preventDefault();
    capture(event, true);
    const point = pointOf(event);

    if (tool === 'note') {
      const anchor = toPdfPoint(point, size, scale, rotation);
      emit(
        createAnnotation({
          kind: 'note',
          page,
          color,
          author,
          rect: { x: anchor.x, y: anchor.y - NOTE_SIZE, width: NOTE_SIZE, height: NOTE_SIZE },
        }),
      );
      return;
    }

    if (tool === 'ink') stroke = [point];
    else {
      start = point;
      end = point;
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (!draws) return;
    if (tool === 'ink' && stroke.length > 0) stroke = [...stroke, pointOf(event)];
    else if (start) end = pointOf(event);
  }

  function onPointerUp(event: PointerEvent): void {
    if (!draws) return;
    capture(event, false);

    if (tool === 'ink' && stroke.length > 0) {
      const points = simplify(stroke).map((point) => toPdfPoint(point, size, scale, rotation));
      emit(createAnnotation({ kind: 'ink', page, color, author, ink: [points] }));
      finish();
      return;
    }

    if ((tool === 'rect' || tool === 'ellipse') && start && end) {
      const drawn = dragRect(start, end);
      if (bigEnough(drawn)) {
        const rect = toPdfRect(
          { x: drawn.x, y: drawn.y, width: drawn.width, height: drawn.height },
          size,
          scale,
          rotation,
        );
        emit(createAnnotation({ kind: tool, page, color, author, rect }));
      }
    }
    finish();
  }
</script>

<svg
  bind:this={root}
  class="layer"
  class:drawing={draws}
  role="presentation"
  width={width}
  height={height}
  viewBox="0 0 {width} {height}"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={finish}
>
  {#each painted as entry (entry.annotation.id)}
    <g
      class="mark"
      style="opacity: {entry.annotation.opacity}"
      class:multiply={entry.annotation.kind === 'highlight'}
    >
      {#each entry.shape.rects as rect, i (i)}
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          fill={entry.annotation.kind === 'rect' ? 'none' : entry.annotation.color}
          stroke={entry.annotation.kind === 'rect' ? entry.annotation.color : 'none'}
          stroke-width={entry.shape.strokeWidth}
        />
      {/each}
      {#each entry.shape.polylines as points, i (i)}
        <polyline
          points={points}
          fill="none"
          stroke={entry.annotation.color}
          stroke-width={entry.shape.strokeWidth}
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      {/each}
      {#if entry.shape.ellipse}
        <ellipse
          cx={entry.shape.ellipse.cx}
          cy={entry.shape.ellipse.cy}
          rx={entry.shape.ellipse.rx}
          ry={entry.shape.ellipse.ry}
          fill="none"
          stroke={entry.annotation.color}
          stroke-width={entry.shape.strokeWidth}
        />
      {/if}
      {#if entry.shape.note}
        <g class="note">
          <rect
            x={entry.shape.note.x}
            y={entry.shape.note.y}
            width={entry.shape.note.width}
            height={entry.shape.note.height * 0.72}
            rx={entry.shape.note.width * 0.2}
            fill={entry.annotation.color}
            stroke="rgba(0,0,0,0.45)"
            stroke-width="0.7"
          />
          <line
            x1={entry.shape.note.x + entry.shape.note.width * 0.18}
            y1={entry.shape.note.y + entry.shape.note.height * 0.26}
            x2={entry.shape.note.x + entry.shape.note.width * 0.82}
            y2={entry.shape.note.y + entry.shape.note.height * 0.26}
            stroke="rgba(255,255,255,0.9)"
          />
          <line
            x1={entry.shape.note.x + entry.shape.note.width * 0.18}
            y1={entry.shape.note.y + entry.shape.note.height * 0.45}
            x2={entry.shape.note.x + entry.shape.note.width * 0.62}
            y2={entry.shape.note.y + entry.shape.note.height * 0.45}
            stroke="rgba(255,255,255,0.9)"
          />
        </g>
      {/if}
    </g>
  {/each}

  {#each hits as entry (entry.annotation.id)}
    <rect
      class="hit"
      class:on={!draws}
      class:selected={entry.annotation.id === selectedId}
      x={entry.box!.x}
      y={entry.box!.y}
      width={entry.box!.width}
      height={entry.box!.height}
      role="button"
      tabindex="-1"
      aria-label={entry.annotation.kind}
      onpointerdown={(event) => {
        if (draws) return;
        event.stopPropagation();
        onselect(entry.annotation.id);
      }}
    />
  {/each}

  {#if preview && (tool === 'rect' || tool === 'ellipse')}
    {#if tool === 'rect'}
      <rect
        class="preview"
        x={preview.x}
        y={preview.y}
        width={preview.width}
        height={preview.height}
        stroke={color}
      />
    {:else}
      <ellipse
        class="preview"
        cx={preview.x + preview.width / 2}
        cy={preview.y + preview.height / 2}
        rx={preview.width / 2}
        ry={preview.height / 2}
        stroke={color}
      />
    {/if}
  {/if}

  {#if stroke.length > 0}
    <polyline
      class="preview"
      points={inkPreview}
      stroke={color}
      stroke-width={INK_WIDTH * scale}
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  {/if}
</svg>

<style>
  .layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    touch-action: none;
  }

  .layer.drawing {
    pointer-events: auto;
    cursor: crosshair;
  }

  .multiply {
    mix-blend-mode: multiply;
  }

  .hit {
    fill: transparent;
    stroke: none;
    pointer-events: none;
    outline: none;
  }

  .hit.on {
    pointer-events: all;
    cursor: pointer;
  }

  .hit.selected {
    fill: rgba(64, 120, 240, 0.12);
    stroke: var(--accent);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .preview {
    fill: none;
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }
</style>
