<script lang="ts">
  import { t } from '$lib/i18n';

  interface Props {
    svg: string;
    onclose: () => void;
    onsave: (format: 'svg' | 'png', data: string) => void;
  }

  const { svg, onclose, onsave }: Props = $props();

  const MIN = 0.2;
  const MAX = 8;

  let stage = $state<HTMLElement | null>(null);
  let scale = $state(1);
  let offsetX = $state(0);
  let offsetY = $state(0);
  let dragging = $state(false);
  let originX = 0;
  let originY = 0;

  function clamp(value: number): number {
    return Math.min(MAX, Math.max(MIN, value));
  }

  function zoomBy(factor: number): void {
    scale = clamp(scale * factor);
  }

  function fit(): void {
    const box = stage?.getBoundingClientRect();
    const picture = stage?.querySelector('svg');
    if (!box || !picture) {
      scale = 1;
      offsetX = 0;
      offsetY = 0;
      return;
    }
    const width = picture.getBoundingClientRect().width / scale;
    const height = picture.getBoundingClientRect().height / scale;
    if (width === 0 || height === 0) return;
    scale = clamp(Math.min((box.width - 64) / width, (box.height - 64) / height));
    offsetX = 0;
    offsetY = 0;
  }

  function reset(): void {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15);
  }

  function startDrag(event: PointerEvent): void {
    if (event.button !== 0) return;
    dragging = true;
    originX = event.clientX - offsetX;
    originY = event.clientY - offsetY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function drag(event: PointerEvent): void {
    if (!dragging) return;
    offsetX = event.clientX - originX;
    offsetY = event.clientY - originY;
  }

  function endDrag(event: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  function onKeyDown(event: KeyboardEvent): void {
    const keys: Record<string, () => void> = {
      Escape: onclose,
      '+': () => zoomBy(1.2),
      '=': () => zoomBy(1.2),
      '-': () => zoomBy(1 / 1.2),
      '0': reset,
      f: fit,
      F: fit,
      ArrowUp: () => (offsetY += 40),
      ArrowDown: () => (offsetY -= 40),
      ArrowLeft: () => (offsetX += 40),
      ArrowRight: () => (offsetX -= 40),
    };
    const handler = keys[event.key];
    if (!handler) return;
    event.preventDefault();
    handler();
  }

  async function toPng(): Promise<string | null> {
    const picture = stage?.querySelector('svg');
    if (!picture) return null;
    const box = picture.getBoundingClientRect();
    const width = Math.max(1, Math.round(box.width / scale));
    const height = Math.max(1, Math.round(box.height / scale));
    const ratio = 2;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('no se pudo leer el diagrama'));
        image.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.scale(ratio, ratio);
      context.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function saveAs(format: 'svg' | 'png'): Promise<void> {
    if (format === 'svg') {
      onsave('svg', svg);
      return;
    }
    const data = await toPng();
    if (data) onsave('png', data);
  }

  $effect(() => {
    void svg;
    requestAnimationFrame(fit);
  });
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="viewer" role="dialog" aria-modal="true" aria-label={t('diagram.title')}>
  <header>
    <span class="title">{t('diagram.title')}</span>
    <div class="tools">
      <button onclick={() => zoomBy(1 / 1.2)} title={t('diagram.zoomOut')} aria-label={t('diagram.zoomOut')}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8h8" /></svg>
      </button>
      <span class="level">{Math.round(scale * 100)}%</span>
      <button onclick={() => zoomBy(1.2)} title={t('diagram.zoomIn')} aria-label={t('diagram.zoomIn')}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 4v8M4 8h8" /></svg>
      </button>
      <button class="text" onclick={fit}>{t('diagram.fit')}</button>
      <button class="text" onclick={reset}>{t('diagram.actualSize')}</button>
      <span class="divider"></span>
      <button class="text" onclick={() => void saveAs('svg')}>{t('diagram.saveSvg')}</button>
      <button class="text" onclick={() => void saveAs('png')}>{t('diagram.savePng')}</button>
      <span class="divider"></span>
      <button onclick={onclose} title={t('diagram.close')} aria-label={t('diagram.close')}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
      </button>
    </div>
  </header>

  <div
    class="stage"
    class:dragging
    bind:this={stage}
    role="presentation"
    onwheel={onWheel}
    onpointerdown={startDrag}
    onpointermove={drag}
    onpointerup={endDrag}
    onpointercancel={endDrag}
  >
    <div class="canvas" style="transform: translate({offsetX}px, {offsetY}px) scale({scale})">
      {@html svg}
    </div>
  </div>

  <footer>{t('diagram.hint')}</footer>
</div>

<style>
  .viewer {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: grid;
    grid-template-rows: auto 1fr auto;
    background: var(--bg);
  }

  header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 12px;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border);
  }

  .title {
    font-weight: 600;
  }

  .tools {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }

  .tools button {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 26px;
    min-width: 28px;
    padding: 0 6px;
    border-radius: 5px;
    color: var(--text-muted);
  }

  .tools button:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .tools svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
  }

  .level {
    min-width: 46px;
    text-align: center;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .divider {
    width: 1px;
    height: 18px;
    margin: 0 4px;
    background: var(--border);
  }

  .stage {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-inset);
    cursor: grab;
    touch-action: none;
  }

  .stage.dragging {
    cursor: grabbing;
  }

  .canvas {
    transform-origin: center center;
    transition: transform 60ms linear;
    will-change: transform;
  }

  .canvas :global(svg) {
    display: block;
    max-width: none;
    height: auto;
  }

  footer {
    padding: 6px 12px;
    background: var(--bg-elevated);
    border-top: 1px solid var(--border);
    color: var(--text-faint);
    font-size: 12px;
  }
</style>
