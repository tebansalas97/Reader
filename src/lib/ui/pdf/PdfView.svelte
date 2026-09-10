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
  import type { TextEdit } from '$lib/pdf/edit/document';
  import type { TextRun } from '$lib/pdf/edit/runs';
  import type { TextPiece } from '$lib/pdf/text-layer';
  import { copiesOf, toggleSelection } from '$lib/pdf/annotations/multi';
  import { editFor, textEdits } from '$lib/state/textedit.svelte';
  import TextEditPopover from './TextEditPopover.svelte';
  import { fieldsOnPage, type FormField } from '$lib/pdf/forms/model';
  import { readFields } from '$lib/pdf/forms/read';
  import { movedBy } from '$lib/pdf/annotations/transform';
  import { openPdfDocument, PdfOpenError, type PdfHandle } from '$lib/pdf/document';
  import { scaleFor } from '$lib/pdf/render';
  import { offsetOfPage, visibleRange } from '$lib/pdf/virtual';
  import {
    pageOfRow,
    pageStep,
    rowHeights,
    rowOfPage,
    rowWidths,
    rowsFor,
    type ReadMode,
  } from '$lib/pdf/spread';
  import {
    anchoredOffset,
    pageHeights,
    pageWidths,
    tallestPage,
    wheelZoom,
    widestPage,
  } from '$lib/pdf/zoom';
  import type { PageEdit } from '$lib/pdf/pages';
  import { documents, type PdfDocument } from '$lib/state/documents.svelte';
  import type { StampItem } from '$lib/state/stamps.svelte';
  import { ui, type AnnotationTool } from '$lib/state/ui.svelte';
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
    selectedIds?: string[];
    stamp?: StampItem | null;
    oncreate?: (annotations: Annotation[]) => void;
    onselect?: (ids: string[]) => void;
    onchange?: (annotation: Annotation) => void;
    ondelete?: (ids: string[]) => void;
    hit?: { page: number; items: number[] } | null;
    night?: boolean;
    mode?: ReadMode;
    onedit?: (edit: TextEdit) => void;
    onunedit?: (id: string) => void;
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
    selectedIds = [],
    stamp = null,
    oncreate,
    onselect,
    onchange,
    ondelete,
    hit = null,
    night = false,
    mode = 'continuous',
    onedit,
    onunedit,
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

  const room = $derived(
    mode === 'double'
      ? { width: Math.max(1, (viewportWidth - GAP) / 2), height: viewportHeight }
      : { width: viewportWidth, height: viewportHeight },
  );

  const scale = $derived(
    fitSize === null ? 1 : scaleFor(fitSize, zoom, room, rotation, PADDING),
  );

  const heights = $derived(pageHeights(sizes, scale, rotation));
  const rows = $derived(rowsFor(mode, sizes.length, doc?.page ?? 1));
  const bands = $derived(rowHeights(rows, heights));
  const range = $derived(visibleRange(bands, scrollTop - PADDING, viewportHeight, 2, GAP));
  const annotations = $derived(doc?.annotations ?? []);
  const edits = $derived(doc?.edits ?? []);
  const picking = $derived(tool === 'text');

  let editing = $state<{
    page: number;
    run: TextRun;
    oldText: string;
    value: string;
    problem: string;
    x: number;
    y: number;
  } | null>(null);
  let checking = $state(false);
  const byPage = $derived(
    annotations.reduce((map, annotation) => {
      const list = map.get(annotation.page);
      if (list) list.push(annotation);
      else map.set(annotation.page, [annotation]);
      return map;
    }, new Map<number, Annotation[]>()),
  );

  const selectedId = $derived(selectedIds.length === 1 ? selectedIds[0]! : null);
  const selected = $derived(annotations.find((entry) => entry.id === selectedId) ?? null);
  let anchor = $state<{ x: number; y: number } | null>(null);

  const widths = $derived(pageWidths(sizes, scale, rotation));
  const stripWidth = $derived(
    Math.max(viewportWidth, Math.max(0, ...rowWidths(rows, widths, GAP)) + PADDING * 2),
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
    if (!node || bands.length === 0) return;
    const target = offsetOfPage(bands, rowOfPage(rows, page - 1), GAP) + PADDING;
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
    if (programmatic || bands.length === 0 || mode === 'single') return;
    const first = visibleRange(bands, node.scrollTop - PADDING, node.clientHeight, 0, GAP).first;
    const page = pageOfRow(rows, first);
    if (doc && page !== doc.page) documents.setPage(docId, page);
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
    const ids = selectedIds;
    if (ids.length === 0) return;

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
        ondelete?.(ids);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && (event.key === 'd' || event.key === 'D')) {
        event.preventDefault();
        const copies = copiesOf(annotations, ids);
        if (copies.length > 0) oncreate?.(copies);
        return;
      }

      const step = NUDGE[event.key];
      if (!step) return;
      const size = event.shiftKey ? 10 : 1;
      const moving = annotations.filter((entry) => ids.includes(entry.id));
      if (moving.length === 0) return;
      event.preventDefault();
      for (const annotation of moving) {
        onchange?.(movedBy(annotation, step[0] * size, step[1] * size));
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  $effect(() => {
    if (mode === 'continuous') return;

    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      const count = sizes.length;
      const page = doc?.page ?? 1;
      const node = scroller;
      const atBottom = !node || node.scrollTop + node.clientHeight >= node.scrollHeight - 4;
      const atTop = !node || node.scrollTop <= 4;

      let next = page;
      if (event.key === 'PageDown') {
        if (!atBottom) return;
        next = pageStep(mode, page, count, true);
      } else if (event.key === 'PageUp') {
        if (!atTop) return;
        next = pageStep(mode, page, count, false);
      } else if (event.key === 'Home') next = 1;
      else if (event.key === 'End') next = count;
      else return;

      event.preventDefault();
      if (next !== page) documents.setPage(docId, next);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  $effect(() => {
    ui.editingText = editing !== null;
    return () => {
      ui.editingText = false;
    };
  });

  function repaintable(annotation: Annotation): boolean {
    return annotation.kind !== 'stamp' || typeof annotation.image === 'string';
  }

  async function pickText(page: number, piece: TextPiece, at: DOMRect): Promise<void> {
    const path = doc?.path;
    if (!path || !doc) return;

    await textEdits.open(doc.id, path);
    const found = await textEdits.runAt(page, piece.originX, piece.originY);
    if (!found) {
      onfailed?.(t('pdf.editNotFound'));
      return;
    }

    editing = {
      page,
      run: found.run,
      oldText: found.text,
      value: found.text,
      problem: '',
      x: at.left + at.width / 2,
      y: at.bottom,
    };
    await checkEditing(found.text);
  }

  async function checkEditing(value: string): Promise<void> {
    const current = editing;
    if (!current) return;
    checking = true;
    const outcome = await textEdits.check(current.page, current.run, value);
    checking = false;
    if (!editing) return;
    editing = {
      ...editing,
      value,
      problem: outcome.ok ? '' : t(`pdf.editWhy.${outcome.reason}`, { detail: outcome.detail }),
    };
  }

  function commitEdit(): void {
    const current = editing;
    if (!current || current.problem !== '') return;
    if (current.value !== current.oldText) {
      onedit?.(editFor(current.page, current.run, current.oldText, current.value));
    }
    editing = null;
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
    if (selectedIds.length > 0) onselect?.([]);
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
      {#each rows as row, band (band)}
      <div class="row" style="gap: {GAP}px">
      {#each row as index (index)}
        {@const size = sizes[index]!}
        <PdfPage
          {index}
          page={plan[index]?.source ?? index + 1}
          {size}
          {scale}
          {rotation}
          live={band >= range.renderFirst && band <= range.renderLast}
          getPage={(n) => handle!.page(plan[n - 1]?.source ?? n)}
          annotations={byPage.get(plan[index]?.source ?? index + 1) ?? []}
          fields={fieldsOnPage(doc?.fields ?? [], plan[index]?.source ?? index + 1)}
          values={doc?.fieldValues ?? {}}
          onvalue={(name, value) => onvalue?.(name, value)}
          {tool}
          {color}
          {author}
          {selectedIds}
          {stamp}
          edits={edits.filter((entry) => entry.page === (plan[index]?.source ?? index + 1))}
          flash={hit && hit.page === (plan[index]?.source ?? index + 1) ? hit.items : []}
          {night}
          {picking}
          onpick={(piece) => {
            const element = scroller?.querySelector<HTMLElement>(
              `.page[data-page="${plan[index]?.source ?? index + 1}"]`,
            );
            const box = element?.getBoundingClientRect();
            if (box) {
              void pickText(plan[index]?.source ?? index + 1, piece, {
                left: box.left + piece.left,
                bottom: box.top + piece.top + piece.height,
                width: piece.width,
              } as DOMRect);
            }
          }}
          onunedit={(id) => onunedit?.(id)}
          oncreate={(annotation) => oncreate?.([annotation])}
          onselect={(id, additive) => onselect?.(toggleSelection(selectedIds, id, additive))}
          onchange={(annotation) => onchange?.(annotation)}
        />
      {/each}
      </div>
      {/each}
    </div>
  {/if}
</div>

{#if editing}
  <TextEditPopover
    x={editing.x}
    y={editing.y}
    value={editing.value}
    problem={editing.problem}
    busy={checking}
    onchange={(value) => void checkEditing(value)}
    oncommit={commitEdit}
    oncancel={() => (editing = null)}
  />
{/if}

{#if selected && anchor}
  <AnnotationPopover
    annotation={selected}
    x={anchor.x}
    y={anchor.y}
    onchange={(annotation) => onchange?.(annotation)}
    ondelete={(id) => ondelete?.([id])}
    onclose={() => onselect?.([])}
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

  .row {
    display: flex;
    align-items: flex-start;
  }

  .note {
    margin: 0;
    padding: 24px;
    text-align: center;
    color: var(--text-faint);
  }
</style>
