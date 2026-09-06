<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    ratio: number;
    onratio: (value: number) => void;
    left: Snippet;
    right: Snippet;
  }

  const { ratio, onratio, left, right }: Props = $props();

  let container = $state<HTMLElement | null>(null);
  let dragging = $state(false);

  function clamp(value: number): number {
    return Math.min(0.8, Math.max(0.2, value));
  }

  function start(event: PointerEvent): void {
    dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent): void {
    if (!dragging || !container) return;
    const box = container.getBoundingClientRect();
    if (box.width === 0) return;
    onratio(clamp((event.clientX - box.left) / box.width));
  }

  function end(event: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  function key(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') onratio(clamp(ratio - 0.02));
    if (event.key === 'ArrowRight') onratio(clamp(ratio + 0.02));
  }
</script>

<div class="split" bind:this={container} style="--ratio: {ratio}">
  <div class="pane">{@render left()}</div>
  <div
    class="divider"
    class:dragging
    role="separator"
    tabindex="0"
    aria-orientation="vertical"
    aria-valuenow={Math.round(ratio * 100)}
    aria-label="Ajustar el ancho de los paneles"
    onpointerdown={start}
    onpointermove={move}
    onpointerup={end}
    onpointercancel={end}
    onkeydown={key}
  ></div>
  <div class="pane">{@render right()}</div>
</div>

<style>
  .split {
    display: grid;
    grid-template-columns: calc(var(--ratio) * 100%) 1px 1fr;
    height: 100%;
    min-height: 0;
  }

  .pane {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .divider {
    position: relative;
    background: var(--border);
    cursor: col-resize;
    touch-action: none;
  }

  .divider::after {
    content: '';
    position: absolute;
    inset: 0 -4px;
  }

  .divider:hover,
  .divider.dragging,
  .divider:focus-visible {
    background: var(--accent);
    outline: none;
  }
</style>
