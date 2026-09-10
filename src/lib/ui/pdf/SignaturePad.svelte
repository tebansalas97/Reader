<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Point } from '$lib/pdf/annotations/model';
  import { normalisedStrokes, placedStrokes } from '$lib/pdf/annotations/signature';

  interface Props {
    strokes: Point[][];
    onuse: (strokes: Point[][]) => void;
    onclose: () => void;
  }

  const { strokes, onuse, onclose }: Props = $props();

  const WIDTH = 460;
  const HEIGHT = 170;

  function seeded(): Point[][] {
    if (strokes.length === 0) return [];
    return placedStrokes(strokes, {
      x: 20,
      y: HEIGHT - 20,
      width: WIDTH - 40,
      height: HEIGHT - 60,
    });
  }

  let drawn = $state<Point[][]>(seeded());
  let current = $state<Point[] | null>(null);
  let board = $state<SVGSVGElement | null>(null);

  const lines = $derived(
    [...drawn, ...(current ? [current] : [])].map((stroke) =>
      stroke.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' '),
    ),
  );
  const empty = $derived(drawn.length === 0 && current === null);

  function at(event: PointerEvent): Point {
    const rect = board?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    try {
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
    } catch {
      current = null;
    }
    current = [at(event)];
  }

  function move(event: PointerEvent): void {
    if (!current) return;
    current = [...current, at(event)];
  }

  function end(): void {
    if (!current) return;
    if (current.length > 1) drawn = [...drawn, current];
    current = null;
  }
</script>

<div class="backdrop" role="presentation" onclick={onclose}></div>

<div class="pad" role="dialog" aria-label={t('pdf.signature')} tabindex="-1">
  <p class="hint">{t('pdf.signatureHint')}</p>

  <svg
    bind:this={board}
    class="board"
    width={WIDTH}
    height={HEIGHT}
    viewBox="0 0 {WIDTH} {HEIGHT}"
    role="presentation"
    onpointerdown={start}
    onpointermove={move}
    onpointerup={end}
    onpointerleave={end}
    onpointercancel={end}
  >
    <line class="rule" x1="20" y1={HEIGHT - 34} x2={WIDTH - 20} y2={HEIGHT - 34} />
    {#each lines as points, index (index)}
      <polyline {points} />
    {/each}
  </svg>

  <div class="row">
    <button class="text" disabled={empty} onclick={() => (drawn = [])}>
      {t('pdf.signatureClear')}
    </button>
    <div class="grow"></div>
    <button class="text" onclick={onclose}>{t('dialog.cancel')}</button>
    <button
      class="text primary"
      disabled={empty}
      onclick={() => onuse(normalisedStrokes(drawn))}
    >
      {t('pdf.signatureUse')}
    </button>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 50;
  }

  .pad {
    position: fixed;
    z-index: 51;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
  }

  .hint {
    margin: 0;
    color: var(--text-muted);
  }

  .board {
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 6px;
    touch-action: none;
    cursor: crosshair;
  }

  .board polyline {
    fill: none;
    stroke: #101010;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .rule {
    stroke: #c8c8c8;
    stroke-width: 1;
    stroke-dasharray: 5 4;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .grow {
    flex: 1;
  }

  .text {
    height: 28px;
    padding: 0 10px;
    border-radius: 6px;
    color: var(--text);
  }

  .text:hover:not(:disabled) {
    background: var(--bg-hover);
  }

  .text:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .primary {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .primary:hover:not(:disabled) {
    background: var(--accent-soft);
    filter: brightness(1.15);
  }
</style>
