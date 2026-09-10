<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Point } from '$lib/pdf/annotations/model';
  import {
    decodeSignature,
    encodeSignature,
    normalisedStrokes,
    placedStrokes,
    signatureRatio,
  } from '$lib/pdf/annotations/signature';
  import { ratioOf } from '$lib/pdf/annotations/stamp';
  import { newStampId, stamps, type StampItem } from '$lib/state/stamps.svelte';

  interface Props {
    onplace: (item: StampItem) => void;
    onimport: () => void;
    onclose: () => void;
  }

  const { onplace, onimport, onclose }: Props = $props();

  const WIDTH = 420;
  const HEIGHT = 150;
  const NAME_FONTS = "'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive";

  let mode = $state<'list' | 'draw' | 'type'>('list');
  let drawn = $state<Point[][]>([]);
  let current = $state<Point[] | null>(null);
  let board = $state<SVGSVGElement | null>(null);
  let typed = $state('');

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

  function keepDrawn(): void {
    const strokes = normalisedStrokes(drawn);
    if (strokes.length === 0) return;
    stamps.add({
      id: newStampId(),
      name: t('pdf.signature'),
      kind: 'draw',
      strokes: encodeSignature(strokes),
      image: '',
      ratio: signatureRatio(drawn),
    });
    drawn = [];
    mode = 'list';
  }

  function keepTyped(): void {
    const text = typed.trim();
    if (text === '') return;

    const canvas = document.createElement('canvas');
    const size = 96;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.font = `${size}px ${NAME_FONTS}`;
    const width = Math.ceil(context.measureText(text).width) + 24;
    const height = Math.ceil(size * 1.5);
    canvas.width = width;
    canvas.height = height;

    const paint = canvas.getContext('2d');
    if (!paint) return;
    paint.clearRect(0, 0, width, height);
    paint.font = `${size}px ${NAME_FONTS}`;
    paint.fillStyle = '#101010';
    paint.textBaseline = 'middle';
    paint.fillText(text, 12, height / 2);

    stamps.add({
      id: newStampId(),
      name: text,
      kind: 'image',
      strokes: '',
      image: canvas.toDataURL('image/png'),
      ratio: ratioOf(width, height),
    });
    typed = '';
    mode = 'list';
  }

  function preview(item: StampItem): string {
    if (item.kind === 'image') return '';
    const strokes = placedStrokes(decodeSignature(item.strokes), {
      x: 4,
      y: 44,
      width: 112,
      height: 36,
    });
    return strokes
      .map((stroke) => stroke.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))
      .join('|');
  }
</script>

<div class="backdrop" role="presentation" onclick={onclose}></div>

<div class="library" role="dialog" aria-label={t('pdf.stamps')} tabindex="-1">
  <div class="head">
    <h2>{t('pdf.stamps')}</h2>
    <div class="grow"></div>
    {#if mode === 'list'}
      <button class="text" onclick={() => (mode = 'draw')}>{t('pdf.stampDraw')}</button>
      <button class="text" onclick={() => (mode = 'type')}>{t('pdf.stampType')}</button>
      <button class="text" onclick={onimport}>{t('pdf.stampImport')}</button>
    {:else}
      <button class="text" onclick={() => (mode = 'list')}>{t('dialog.cancel')}</button>
    {/if}
  </div>

  {#if mode === 'draw'}
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
      <line class="rule" x1="20" y1={HEIGHT - 30} x2={WIDTH - 20} y2={HEIGHT - 30} />
      {#each lines as points, index (index)}
        <polyline {points} />
      {/each}
    </svg>
    <div class="row">
      <button class="text" disabled={empty} onclick={() => (drawn = [])}>
        {t('pdf.signatureClear')}
      </button>
      <div class="grow"></div>
      <button class="text primary" disabled={empty} onclick={keepDrawn}>
        {t('pdf.stampKeep')}
      </button>
    </div>
  {:else if mode === 'type'}
    <input
      class="typed"
      style="font-family: {NAME_FONTS}"
      placeholder={t('pdf.stampTypeHint')}
      aria-label={t('pdf.stampType')}
      bind:value={typed}
      onkeydown={(event) => {
        if (event.key === 'Enter') keepTyped();
      }}
    />
    <div class="row">
      <div class="grow"></div>
      <button class="text primary" disabled={typed.trim() === ''} onclick={keepTyped}>
        {t('pdf.stampKeep')}
      </button>
    </div>
  {:else if stamps.items.length === 0}
    <p class="empty">{t('pdf.stampsEmpty')}</p>
  {:else}
    <ul class="items">
      {#each stamps.items as item (item.id)}
        <li class="item">
          <button class="use" title={t('pdf.stampPlace')} onclick={() => onplace(item)}>
            <span class="thumb">
              {#if item.kind === 'image'}
                <img src={item.image} alt="" />
              {:else}
                <svg viewBox="0 0 120 60" aria-hidden="true">
                  {#each preview(item).split('|') as points, index (index)}
                    <polyline {points} />
                  {/each}
                </svg>
              {/if}
            </span>
          </button>
          <input
            class="name"
            value={item.name}
            aria-label={t('pdf.stampName')}
            onchange={(event) => stamps.rename(item.id, event.currentTarget.value)}
          />
          <button
            class="drop"
            title={t('pdf.deleteMark')}
            aria-label={t('pdf.deleteMark')}
            onclick={() => stamps.remove(item.id)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 50;
  }

  .library {
    position: fixed;
    z-index: 51;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 460px;
    max-height: 78vh;
    padding: 14px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  h2 {
    margin: 0;
    font-size: 1.05em;
  }

  .grow {
    flex: 1;
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

  .typed {
    height: 64px;
    padding: 0 12px;
    font-size: 30px;
    background: #ffffff;
    color: #101010;
    border: 1px solid var(--border);
    border-radius: 6px;
    outline: none;
  }

  .items {
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .use {
    padding: 0;
    border-radius: 6px;
  }

  .thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 122px;
    height: 62px;
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }

  .use:hover .thumb {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }

  .thumb img {
    max-width: 100%;
    max-height: 100%;
  }

  .thumb svg {
    width: 100%;
    height: 100%;
  }

  .thumb polyline {
    fill: none;
    stroke: #101010;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .name {
    flex: 1;
    min-width: 0;
    height: 26px;
    padding: 0 6px;
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--text);
    outline: none;
  }

  .name:focus {
    border-color: var(--accent);
  }

  .drop {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 5px;
    color: var(--text-faint);
  }

  .drop:hover {
    color: var(--danger);
    background: var(--bg-hover);
  }

  .drop svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 6px;
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

  .empty {
    margin: 0;
    padding: 10px 2px;
    color: var(--text-faint);
  }
</style>
