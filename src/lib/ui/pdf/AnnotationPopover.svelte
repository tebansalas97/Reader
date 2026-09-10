<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Annotation } from '$lib/pdf/annotations/model';
  import { fontSizeOf } from '$lib/pdf/annotations/freetext';
  import { canEdit } from '$lib/pdf/annotations/transform';
  import { PALETTE } from '$lib/pdf/annotations/palette';

  interface Props {
    annotation: Annotation;
    x: number;
    y: number;
    onchange: (annotation: Annotation) => void;
    ondelete: (id: string) => void;
    onclose: () => void;
  }

  const { annotation, x, y, onchange, ondelete, onclose }: Props = $props();

  let node = $state<HTMLElement | null>(null);
  let field = $state<HTMLTextAreaElement | null>(null);
  const writing = $derived(annotation.kind === 'freetext');
  let left = $state(0);
  let top = $state(0);

  $effect(() => {
    const element = node;
    const wanted = { x, y };
    if (!element) return;
    const box = element.getBoundingClientRect();
    const maxLeft = globalThis.innerWidth - box.width - 8;
    const maxTop = globalThis.innerHeight - box.height - 8;
    left = Math.max(8, Math.min(maxLeft, wanted.x - box.width / 2));
    top = Math.max(8, Math.min(maxTop, wanted.y + 8));
  });

  function setColor(color: string): void {
    if (color !== annotation.color) onchange({ ...annotation, color });
  }

  function setContents(value: string): void {
    if (value !== annotation.contents) onchange({ ...annotation, contents: value });
  }

  function setSize(value: number): void {
    const size = Math.min(96, Math.max(4, Math.round(value)));
    if (size !== fontSizeOf(annotation)) onchange({ ...annotation, fontSize: size });
  }

  $effect(() => {
    if (writing) field?.focus();
  });
</script>

<div
  bind:this={node}
  class="popover"
  style="left: {left}px; top: {top}px"
  role="dialog"
  tabindex="-1"
  aria-label={t('pdf.annotation')}
  onkeydown={(event) => {
    if (event.key === 'Escape') onclose();
  }}
>
  {#if canEdit(annotation)}
    <div class="colors">
    {#each PALETTE as color (color)}
      <button
        class="swatch"
        class:on={color.toLowerCase() === annotation.color.toLowerCase()}
        style="--swatch: {color}"
        title={color}
        aria-label={color}
        onclick={() => setColor(color)}
        ></button>
      {/each}
    </div>

    <textarea
      bind:this={field}
      class="note"
      rows={writing ? 3 : 2}
      placeholder={writing ? t('pdf.textHint') : t('pdf.notePlaceholder')}
      value={annotation.contents}
      oninput={(event) => setContents(event.currentTarget.value)}
    ></textarea>

    {#if writing}
      <label class="size">
        <span>{t('pdf.textSize')}</span>
        <input
          type="number"
          min="4"
          max="96"
          step="1"
          value={fontSizeOf(annotation)}
          oninput={(event) => setSize(Number(event.currentTarget.value))}
        />
      </label>
    {/if}
  {/if}

  <div class="row">
    <span class="kind">{t(`pdf.tool.${annotation.kind}`)}</span>
    <button class="delete" onclick={() => ondelete(annotation.id)}>{t('pdf.deleteMark')}</button>
  </div>
</div>

<style>
  .popover {
    position: fixed;
    z-index: 40;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 230px;
    padding: 8px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
  }

  .colors {
    display: flex;
    gap: 4px;
  }

  .swatch {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--swatch);
    border: 2px solid transparent;
  }

  .swatch.on {
    border-color: var(--accent);
  }

  .note {
    width: 100%;
    padding: 5px 6px;
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font: inherit;
    resize: vertical;
    outline: none;
  }

  .note:focus {
    border-color: var(--accent);
  }

  .size {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: var(--text-muted);
  }

  .size input {
    width: 64px;
    height: 24px;
    padding: 0 6px;
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--text);
    outline: none;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .kind {
    color: var(--text-faint);
  }

  .delete {
    height: 24px;
    padding: 0 8px;
    border-radius: 5px;
    color: var(--danger);
  }

  .delete:hover {
    background: var(--bg-hover);
  }
</style>
