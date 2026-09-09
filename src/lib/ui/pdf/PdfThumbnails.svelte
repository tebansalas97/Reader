<script lang="ts">
  import { t } from '$lib/i18n';
  import type { PdfHandle } from '$lib/pdf/document';
  import { dropIndexAt, rangeBetween, toggleIn, type PageEdit } from '$lib/pdf/pages';
  import { createPageRenderer } from '$lib/pdf/render';

  interface Props {
    handle: PdfHandle | null;
    plan: PageEdit[];
    currentPage: number;
    selected: number[];
    onselect: (page: number) => void;
    onselection: (indices: number[]) => void;
    onmove: (indices: number[], to: number) => void;
    onturn: (indices: number[], quarters: 1 | -1) => void;
    onremove: (indices: number[]) => void;
    onextract: (indices: number[]) => void;
  }

  const {
    handle,
    plan,
    currentPage,
    selected,
    onselect,
    onselection,
    onmove,
    onturn,
    onremove,
    onextract,
  }: Props = $props();

  const WIDTH = 132;
  const DRAG_START = 5;

  let list = $state<HTMLElement | null>(null);
  let dragging = $state(false);
  let dropAt = $state<number | null>(null);
  let anchor = 0;
  let start: { index: number; x: number; y: number } | null = null;
  const drawn = new Set<string>();

  const chosen = $derived(new Set(selected));
  const key = $derived(plan.map((entry) => `${entry.source}:${entry.rotation}`).join(','));

  function sizeOf(index: number) {
    const entry = plan[index];
    const size = entry ? handle?.pageSizes[entry.source - 1] : undefined;
    if (!size || size.width === 0) return { width: WIDTH, height: WIDTH * 1.4, scale: 1 };
    const total = (size.rotation + (entry?.rotation ?? 0)) % 180;
    const width = total === 90 ? size.height : size.width;
    const height = total === 90 ? size.width : size.height;
    return { width: WIDTH, height: (height / width) * WIDTH, scale: WIDTH / width };
  }

  async function draw(canvas: HTMLCanvasElement, index: number): Promise<void> {
    const entry = plan[index];
    if (!handle || !entry) return;
    const stamp = `${index}:${entry.source}:${entry.rotation}`;
    if (drawn.has(stamp)) return;
    drawn.add(stamp);
    try {
      const page = await handle.page(entry.source);
      const size = handle.pageSizes[entry.source - 1];
      const total = (size?.rotation ?? 0) + entry.rotation;
      await createPageRenderer(canvas).render(page, sizeOf(index).scale, total);
    } catch {
      drawn.delete(stamp);
    }
  }

  $effect(() => {
    const node = list;
    void key;
    if (!node || !handle) return;
    drawn.clear();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const canvas = entry.target.querySelector('canvas');
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (canvas && Number.isFinite(index)) void draw(canvas, index);
        }
      },
      { root: node, rootMargin: '200px' },
    );

    for (const item of Array.from(node.querySelectorAll('.thumb'))) observer.observe(item);
    return () => observer.disconnect();
  });

  $effect(() => {
    const node = list;
    if (!node || dragging) return;
    node
      .querySelector(`.thumb[data-index="${currentPage - 1}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  });

  function boxes(): Array<{ top: number; bottom: number }> {
    const node = list;
    if (!node) return [];
    return Array.from(node.querySelectorAll('.thumb')).map((item) => {
      const rect = item.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    });
  }

  function pick(index: number, event: PointerEvent | MouseEvent): void {
    if (event.shiftKey) {
      onselection(rangeBetween(anchor, index));
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      anchor = index;
      onselection(toggleIn(selected, index));
      return;
    }
    anchor = index;
    onselection([index]);
    onselect(index + 1);
  }

  function onPointerDown(index: number, event: PointerEvent): void {
    if (event.button !== 0) return;
    start = { index, x: event.clientX, y: event.clientY };
    if (!chosen.has(index)) pick(index, event);
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent): void {
    if (!start) return;
    if (!dragging) {
      const far =
        Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y) > DRAG_START;
      if (!far) return;
      dragging = true;
    }
    dropAt = dropIndexAt(boxes(), event.clientY);
  }

  function onPointerUp(index: number, event: PointerEvent): void {
    const began = start;
    const target = dropAt;
    const wasDragging = dragging;
    start = null;
    dragging = false;
    dropAt = null;
    if (!began) return;

    if (wasDragging && target !== null) {
      const moving = chosen.has(began.index) ? selected : [began.index];
      onmove(moving, target);
      return;
    }
    if (chosen.has(index) && selected.length > 1 && !event.ctrlKey && !event.shiftKey) {
      pick(index, event);
      return;
    }
    if (!chosen.has(index)) pick(index, event);
    else if (selected.length === 1 && !event.ctrlKey && !event.shiftKey) onselect(index + 1);
  }

  function cancel(): void {
    start = null;
    dragging = false;
    dropAt = null;
  }
</script>

<div class="tools" role="toolbar" aria-label={t('pages.tools')}>
  <button
    class="tool"
    disabled={selected.length === 0}
    title={t('pages.turnLeft')}
    aria-label={t('pages.turnLeft')}
    onclick={() => onturn(selected, -1)}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8a5 5 0 105-5H3.5" />
      <path d="M6 1L3 3.5 6 6" />
    </svg>
  </button>
  <button
    class="tool"
    disabled={selected.length === 0}
    title={t('pages.turnRight')}
    aria-label={t('pages.turnRight')}
    onclick={() => onturn(selected, 1)}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M13 8a5 5 0 11-5-5h4.5" />
      <path d="M10 1l3 2.5L10 6" />
    </svg>
  </button>
  <button
    class="tool"
    disabled={selected.length === 0 || selected.length >= plan.length}
    title={t('pages.remove')}
    aria-label={t('pages.remove')}
    onclick={() => onremove(selected)}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.6 8.5h4.8l.6-8.5" />
    </svg>
  </button>
  <button
    class="tool"
    disabled={selected.length === 0}
    title={t('pages.extract')}
    aria-label={t('pages.extract')}
    onclick={() => onextract(selected)}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M9 2H4v12h8V5z" />
      <path d="M9 2v3h3" />
      <path d="M6.5 9.5h3M8 8v3" />
    </svg>
  </button>
  <span class="count">{selected.length > 0 ? t('pages.selected', { n: selected.length }) : ''}</span>
</div>

<div class="thumbs" bind:this={list} class:dragging>
  {#each plan as entry, index (`${index}:${entry.source}`)}
    <div class="slot" class:before={dropAt === index}>
      <button
        class="thumb"
        class:active={index + 1 === currentPage}
        class:chosen={chosen.has(index)}
        data-index={index}
        aria-pressed={chosen.has(index)}
        onpointerdown={(event) => onPointerDown(index, event)}
        onpointermove={onPointerMove}
        onpointerup={(event) => onPointerUp(index, event)}
        onpointercancel={cancel}
      >
        <canvas
          style="width: {sizeOf(index).width}px; height: {sizeOf(index).height}px"
          aria-label="{t('pdf.page')} {index + 1}"
        ></canvas>
        <span>{index + 1}</span>
      </button>
    </div>
  {/each}
  {#if dropAt === plan.length}
    <div class="slot last before"></div>
  {/if}
</div>

<style>
  .tools {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 5px 8px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .tool {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 24px;
    border-radius: 5px;
    color: var(--text-muted);
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
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.35;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .count {
    margin-left: auto;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .thumbs {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 10px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .thumbs.dragging {
    cursor: grabbing;
  }

  .slot {
    position: relative;
    display: flex;
    justify-content: center;
    width: 100%;
  }

  .slot.before::before {
    content: '';
    position: absolute;
    top: -6px;
    left: 8px;
    right: 8px;
    height: 2px;
    background: var(--accent);
    border-radius: 2px;
  }

  .slot.last {
    height: 2px;
  }

  .slot.last.before::before {
    top: 0;
  }

  .thumb {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 4px;
    border-radius: 6px;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
    touch-action: none;
  }

  .thumb:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .thumb.active {
    color: var(--accent);
  }

  .thumb.chosen {
    background: var(--accent-soft);
    color: var(--accent);
  }

  canvas {
    display: block;
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 2px;
  }

  .thumb.active canvas {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
</style>
