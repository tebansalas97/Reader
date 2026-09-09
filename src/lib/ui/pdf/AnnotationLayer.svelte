<script lang="ts">
  import { t } from '$lib/i18n';
  import { INK_WIDTH, NOTE_SIZE } from '$lib/pdf/annotations/appearance';
  import { toPdfPoint, toPdfRect } from '$lib/pdf/annotations/geometry';
  import {
    annotationKey,
    boundsOf,
    type Annotation,
    type Point,
    type Rect,
  } from '$lib/pdf/annotations/model';
  import { hitBox, paintAnnotation } from '$lib/pdf/annotations/paint';
  import {
    bigEnough,
    createAnnotation,
    dragRect,
    simplify,
  } from '$lib/pdf/annotations/selection';
  import {
    angleBetween,
    boundsFrom,
    canResize,
    canRotate,
    centreOf,
    movedBy,
    rotatedAround,
    scaledInto,
  } from '$lib/pdf/annotations/transform';
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
    onchange?: (annotation: Annotation) => void;
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
    onchange,
  }: Props = $props();

  type Mode = 'move' | 'resize' | 'rotate';

  interface Gesture {
    mode: Mode;
    original: Annotation;
    start: Point;
    from: Rect;
    anchor: Point;
    centre: Point;
  }

  let root = $state<SVGSVGElement | null>(null);
  let stroke = $state<Point[]>([]);
  let start = $state<Point | null>(null);
  let end = $state<Point | null>(null);
  let gesture = $state<Gesture | null>(null);
  let draft = $state<Annotation | null>(null);

  const box = $derived(rotatedSize(size, rotation));
  const width = $derived(Math.max(1, Math.round(box.width * scale)));
  const height = $derived(Math.max(1, Math.round(box.height * scale)));

  const draws = $derived(tool === 'ink' || tool === 'rect' || tool === 'ellipse' || tool === 'note');
  const shown = $derived(
    annotations.map((annotation) => (draft && draft.id === annotation.id ? draft : annotation)),
  );
  const painted = $derived(
    shown.map((annotation) => ({
      annotation,
      shape: paintAnnotation(annotation, size, scale, rotation),
    })),
  );
  const hits = $derived(
    shown
      .map((annotation) => ({ annotation, box: hitBox(annotation, size, scale, rotation) }))
      .filter((entry) => entry.box !== null),
  );
  const selected = $derived(shown.find((annotation) => annotation.id === selectedId) ?? null);
  const frame = $derived(
    selected && !draws ? (paintAnnotation(selected, size, scale, rotation).box ?? null) : null,
  );
  const corners = $derived(
    frame
      ? [
          { key: 'tl', x: frame.x, y: frame.y, cursor: 'nwse-resize' },
          { key: 'tr', x: frame.x + frame.width, y: frame.y, cursor: 'nesw-resize' },
          { key: 'br', x: frame.x + frame.width, y: frame.y + frame.height, cursor: 'nwse-resize' },
          { key: 'bl', x: frame.x, y: frame.y + frame.height, cursor: 'nesw-resize' },
        ]
      : [],
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

  function inPdf(event: PointerEvent): Point {
    return toPdfPoint(pointOf(event), size, scale, rotation);
  }

  function capture(event: PointerEvent, on: boolean): void {
    const node = event.currentTarget as Element | null;
    try {
      if (on) node?.setPointerCapture(event.pointerId);
      else node?.releasePointerCapture(event.pointerId);
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

  function screenBox(annotation: Annotation): Rect | null {
    return paintAnnotation(annotation, size, scale, rotation).box;
  }

  function cornerAnchor(key: string): Point {
    const annotation = selected;
    const rect = annotation ? screenBox(annotation) : null;
    if (!rect) return { x: 0, y: 0 };

    const opposite =
      {
        tl: { x: rect.x + rect.width, y: rect.y + rect.height },
        tr: { x: rect.x, y: rect.y + rect.height },
        br: { x: rect.x, y: rect.y },
        bl: { x: rect.x + rect.width, y: rect.y },
      }[key] ?? { x: rect.x, y: rect.y };

    return toPdfPoint(opposite, size, scale, rotation);
  }

  function beginGesture(event: PointerEvent, mode: Mode, anchorAt?: Point): void {
    const annotation = selected;
    if (!annotation || event.button !== 0) return;
    const from = boundsOf(annotation);
    const centre = centreOf(annotation);
    if (!from || !centre) return;

    event.stopPropagation();
    event.preventDefault();
    capture(event, true);
    gesture = {
      mode,
      original: annotation,
      start: inPdf(event),
      from,
      anchor: anchorAt ?? { x: from.x, y: from.y },
      centre,
    };
    draft = annotation;
  }

  function updateGesture(event: PointerEvent): void {
    const current = gesture;
    if (!current) return;
    const pointer = inPdf(event);

    if (current.mode === 'move') {
      draft = movedBy(current.original, pointer.x - current.start.x, pointer.y - current.start.y);
    } else if (current.mode === 'resize') {
      draft = scaledInto(current.original, current.from, boundsFrom(current.anchor, pointer));
    } else {
      draft = rotatedAround(
        current.original,
        current.centre,
        angleBetween(current.centre, current.start, pointer),
      );
    }
  }

  function endGesture(event: PointerEvent): void {
    const current = gesture;
    const made = draft;
    if (!current) return;
    capture(event, false);
    gesture = null;
    draft = null;
    if (made && annotationKey(made) !== annotationKey(current.original)) onchange?.(made);
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
    if (gesture) {
      updateGesture(event);
      return;
    }
    if (!draws) return;
    if (tool === 'ink' && stroke.length > 0) stroke = [...stroke, pointOf(event)];
    else if (start) end = pointOf(event);
  }

  function onPointerUp(event: PointerEvent): void {
    if (gesture) {
      endGesture(event);
      return;
    }
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
      {#each entry.shape.quads as points, i (i)}
        <polygon {points} fill={entry.annotation.color} stroke="none" />
      {/each}
      {#each entry.shape.polylines as points, i (i)}
        <polyline
          {points}
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
      class:grab={!draws && entry.annotation.id === selectedId}
      x={entry.box!.x}
      y={entry.box!.y}
      width={entry.box!.width}
      height={entry.box!.height}
      role="button"
      tabindex="-1"
      aria-label={t(`pdf.tool.${entry.annotation.kind}`)}
      onpointerdown={(event) => {
        if (draws) return;
        if (entry.annotation.id === selectedId) {
          beginGesture(event, 'move');
          return;
        }
        event.stopPropagation();
        onselect(entry.annotation.id);
      }}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
    />
  {/each}

  {#if frame && selected}
    <g class="frame">
      <rect class="outline" x={frame.x} y={frame.y} width={frame.width} height={frame.height} />
      {#if canRotate(selected.kind)}
        <line
          class="stem"
          x1={frame.x + frame.width / 2}
          y1={frame.y}
          x2={frame.x + frame.width / 2}
          y2={frame.y - 18}
        />
        <circle
          class="handle turn"
          cx={frame.x + frame.width / 2}
          cy={frame.y - 18}
          r="5"
          role="button"
          tabindex="-1"
          aria-label={t('pdf.rotateMark')}
          onpointerdown={(event) => beginGesture(event, 'rotate')}
          onpointermove={onPointerMove}
          onpointerup={onPointerUp}
        />
      {/if}
      {#if canResize(selected.kind)}
        {#each corners as corner (corner.key)}
          <rect
            class="handle"
            style="cursor: {corner.cursor}"
            x={corner.x - 4}
            y={corner.y - 4}
            width="8"
            height="8"
            role="button"
            tabindex="-1"
            aria-label={t('pdf.resizeMark')}
            onpointerdown={(event) => beginGesture(event, 'resize', cornerAnchor(corner.key))}
            onpointermove={onPointerMove}
            onpointerup={onPointerUp}
          />
        {/each}
      {/if}
    </g>
  {/if}

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

  .hit.grab {
    cursor: move;
  }

  .outline {
    fill: none;
    stroke: var(--accent);
    stroke-width: 1;
    stroke-dasharray: 3 3;
    pointer-events: none;
  }

  .stem {
    stroke: var(--accent);
    stroke-width: 1;
    pointer-events: none;
  }

  .handle {
    fill: var(--bg-elevated);
    stroke: var(--accent);
    stroke-width: 1.5;
    pointer-events: all;
    outline: none;
  }

  .handle.turn {
    cursor: grab;
  }

  .preview {
    fill: none;
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }
</style>
