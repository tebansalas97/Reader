<script lang="ts">
  import type { PdfHandle } from '$lib/pdf/document';
  import { createPageRenderer } from '$lib/pdf/render';

  interface Props {
    handle: PdfHandle | null;
    currentPage: number;
    onselect: (page: number) => void;
  }

  const { handle, currentPage, onselect }: Props = $props();

  const WIDTH = 132;

  let list = $state<HTMLElement | null>(null);
  const drawn = new Set<number>();

  function thumbHeight(index: number): number {
    const size = handle?.pageSizes[index];
    if (!size || size.width === 0) return WIDTH * 1.4;
    const turned = size.rotation % 180 === 90;
    const width = turned ? size.height : size.width;
    const height = turned ? size.width : size.height;
    return (height / width) * WIDTH;
  }

  async function draw(canvas: HTMLCanvasElement, index: number): Promise<void> {
    if (!handle || drawn.has(index)) return;
    drawn.add(index);
    const size = handle.pageSizes[index];
    if (!size) return;
    const turned = size.rotation % 180 === 90;
    const width = turned ? size.height : size.width;
    try {
      const page = await handle.page(index + 1);
      await createPageRenderer(canvas).render(page, WIDTH / width, 0);
    } catch {
      drawn.delete(index);
    }
  }

  $effect(() => {
    const node = list;
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
    if (!node) return;
    node
      .querySelector(`.thumb[data-index="${currentPage - 1}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  });
</script>

<div class="thumbs" bind:this={list}>
  {#if handle}
    {#each handle.pageSizes as _size, index (index)}
      <button
        class="thumb"
        class:active={index + 1 === currentPage}
        data-index={index}
        onclick={() => onselect(index + 1)}
      >
        <canvas style="width: {WIDTH}px; height: {thumbHeight(index)}px"></canvas>
        <span>{index + 1}</span>
      </button>
    {/each}
  {/if}
</div>

<style>
  .thumbs {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 10px;
    overflow-y: auto;
    height: 100%;
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
  }

  .thumb:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .thumb.active {
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
