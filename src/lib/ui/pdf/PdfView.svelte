<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Annotation } from '$lib/pdf/annotations/model';
  import { paintBox } from '$lib/pdf/annotations/paint';
  import { quadsFromRects, type RectLike } from '$lib/pdf/annotations/quads';
  import {
    createAnnotation,
    groupByPage,
    type PageBox,
  } from '$lib/pdf/annotations/selection';
  import { readAnnotations } from '$lib/pdf/annotations/read';
  import { fieldsOnPage, type FormField } from '$lib/pdf/forms/model';
  import { readFields } from '$lib/pdf/forms/read';
  import { movedBy } from '$lib/pdf/annotations/transform';
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
  import type { PageEdit } from '$lib/pdf/pages';
  import { documents, type PdfDocument } from '$lib/state/documents.svelte';
  import type { StampItem } from '$lib/state/stamps.svelte';
  import type { AnnotationTool } from '$lib/state/ui.svelte';
  import AnnotationPopover from './AnnotationPopover.svelte';
  import PdfPage from './PdfPage.svelte';

  interface Props {
    docId: string;
    onready?: (handle: PdfHandle) => void;
    onannotations?: (annotations: Annotation[]) => void;
    onfields?: (fields: FormField[]) => void;
    onvalue?: (name: string, value: string) => void;
    onfailed?: (message: string) => void;
    onscale?: (scale: number) => void;
    tool?: AnnotationTool;
    color?: string;
    author?: string;
    selectedId?: string | null;
    stamp?: StampItem | null;
    oncreate?: (annotations: Annotation[]) => void;
    onselect?: (id: string | null) => void;
    onchange?: (annotation: Annotation) => void;
    ondelete?: (id: string) => void;
  }

  const {
    docId,
    onready,
    onannotations,
    onfields,
    onvalue,
    onfailed,
    onscale,
    tool = 'none',
    color = '#ffd400',
    author = '',
    selectedId = null,
    stamp = null,
    oncreate,
    onselect,
    onchange,
    ondelete,
  }: Props = $props();

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
  const plan = $derived<PageEdit[]>(doc?.pages ?? []);
  const sizes = $derived(
    plan
      .map((entry) => {
        const size = handle?.pageSizes[entry.source - 1];
        if (!size) return null;
        return { ...size, rotation: (size.rotation + entry.rotation) % 360 };
      })
      .filter((size): size is NonNullable<typeof size> => size !== null),
  );
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
  const annotations = $derived(doc?.annotations ?? []);
  const byPage = $derived(
    annotations.reduce((map, annotation) => {
      const list = map.get(annotation.page);
      if (list) list.push(annotation);
      else map.set(annotation.page, [annotation]);
      return map;
    }, new Map<number, Annotation[]>()),
  );

  const selected = $derived(annotations.find((entry) => entry.id === selectedId) ?? null);
  let anchor = $state<{ x: number; y: number } | null>(null);

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
        const found = await readAnnotations(opened).catch(() => []);
        const forms = await readFields(opened).catch(() => []);
        if (cancelled) {
          await opened.destroy();
          return;
        }
        opened.hideFromCanvas([
          ...found.filter(repaintable).map((annotation) => annotation.ref ?? ''),
          ...forms.map((field) => field.id),
        ]);
        onannotations?.(found);
        onfields?.(forms);
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

  $effect(() => {
    const annotation = selected;
    const currentScale = scale;
    const currentRotation = rotation;
    const node = scroller;
    void scrollTop;

    if (!annotation || !node) {
      anchor = null;
      return;
    }

    const size = sizes[annotation.page - 1];
    const element = node.querySelector<HTMLElement>(`.page[data-page="${annotation.page}"]`);
    const box = size ? paintBox(annotation, size, currentScale, currentRotation) : null;
    if (!element || !box) {
      anchor = null;
      return;
    }

    const rect = element.getBoundingClientRect();
    anchor = { x: rect.left + box.x + box.width / 2, y: rect.top + box.y + box.height };
  });

  $effect(() => {
    const annotation = selected;
    const node = scroller;
    void scale;
    void plan;
    if (!annotation || !node) return;

    const currentScale = scale;
    const currentRotation = rotation;

    requestAnimationFrame(() => {
      const element = node.querySelector<HTMLElement>(`.page[data-page="${annotation.page}"]`);
      const size = sizes[pageIndexOfSource(annotation.page)];
      const box = element && size ? paintBox(annotation, size, currentScale, currentRotation) : null;
      if (!element || !box) return;

      const page = element.getBoundingClientRect();
      const view = node.getBoundingClientRect();
      const margin = 24;
      const top = page.top + box.y;
      const bottom = top + box.height;
      const left = page.left + box.x;
      const right = left + box.width;

      let byY = 0;
      if (top < view.top + margin) byY = top - view.top - margin;
      else if (bottom > view.bottom - margin) byY = bottom - view.bottom + margin;

      let byX = 0;
      if (left < view.left + margin) byX = left - view.left - margin;
      else if (right > view.right - margin) byX = right - view.right + margin;

      if (byX === 0 && byY === 0) return;
      programmatic = true;
      node.scrollBy({ top: byY, left: byX });
      requestAnimationFrame(() => {
        programmatic = false;
        scrollTop = node.scrollTop;
      });
    });
  });

  $effect(() => {
    const id: string | null = selectedId;
    if (id === null) return;

    const NUDGE: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
    };

    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        ondelete?.(id as string);
        return;
      }

      const step = NUDGE[event.key];
      if (!step) return;
      const annotation = annotations.find((entry) => entry.id === id);
      if (!annotation) return;
      const size = event.shiftKey ? 10 : 1;
      event.preventDefault();
      onchange?.(movedBy(annotation, step[0] * size, step[1] * size));
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function repaintable(annotation: Annotation): boolean {
    return annotation.kind !== 'stamp' || typeof annotation.image === 'string';
  }

  function pageIndexOfSource(source: number): number {
    return plan.findIndex((entry) => entry.source === source);
  }

  function quadTool(value: AnnotationTool): value is 'highlight' | 'underline' | 'strikeout' {
    return value === 'highlight' || value === 'underline' || value === 'strikeout';
  }

  function pageBoxes(): PageBox[] {
    const node = scroller;
    if (!node) return [];
    return [...node.querySelectorAll<HTMLElement>('.page[data-page]')].map((element) => ({
      page: Number(element.dataset.page),
      rect: element.getBoundingClientRect(),
    }));
  }

  function selectionRects(): RectLike[] {
    const selection = globalThis.getSelection?.();
    if (!selection || selection.isCollapsed) return [];
    const rects: RectLike[] = [];
    for (let index = 0; index < selection.rangeCount; index += 1) {
      rects.push(...selection.getRangeAt(index).getClientRects());
    }
    return rects;
  }

  function onMouseUp(): void {
    if (!quadTool(tool)) return;
    const rects = selectionRects();
    if (rects.length === 0) return;

    const boxes = pageBoxes();
    const made: Annotation[] = [];
    for (const [page, list] of groupByPage(rects, boxes)) {
      const size = sizes[page - 1];
      const box = boxes.find((entry) => entry.page === page);
      if (!size || !box) continue;
      const quads = quadsFromRects(list, box.rect, size, rotation);
      const annotation = createAnnotation({ kind: tool, page, color, author, quads });
      if (annotation) made.push(annotation);
    }

    if (made.length === 0) return;
    globalThis.getSelection?.()?.removeAllRanges();
    oncreate?.(made);
  }

  function onPointerDown(): void {
    if (selectedId !== null) onselect?.(null);
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

<div
  class="viewer"
  bind:this={scroller}
  onscroll={onScroll}
  onwheel={onWheel}
  onmouseup={onMouseUp}
  onpointerdown={onPointerDown}
  role="presentation"
>
  {#if loading}
    <p class="note">{t('pdf.loading')}</p>
  {:else if handle}
    <div class="pages" style="gap: {GAP}px; padding: {PADDING}px; width: {stripWidth}px">
      {#each sizes as size, index (index)}
        <PdfPage
          {index}
          page={plan[index]?.source ?? index + 1}
          {size}
          {scale}
          {rotation}
          live={index >= range.renderFirst && index <= range.renderLast}
          getPage={(n) => handle!.page(plan[n - 1]?.source ?? n)}
          annotations={byPage.get(plan[index]?.source ?? index + 1) ?? []}
          fields={fieldsOnPage(doc?.fields ?? [], plan[index]?.source ?? index + 1)}
          values={doc?.fieldValues ?? {}}
          onvalue={(name, value) => onvalue?.(name, value)}
          {tool}
          {color}
          {author}
          {selectedId}
          {stamp}
          oncreate={(annotation) => oncreate?.([annotation])}
          onselect={(id) => onselect?.(id)}
          onchange={(annotation) => onchange?.(annotation)}
        />
      {/each}
    </div>
  {/if}
</div>

{#if selected && anchor}
  <AnnotationPopover
    annotation={selected}
    x={anchor.x}
    y={anchor.y}
    onchange={(annotation) => onchange?.(annotation)}
    ondelete={(id) => ondelete?.(id)}
    onclose={() => onselect?.(null)}
  />
{/if}

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
