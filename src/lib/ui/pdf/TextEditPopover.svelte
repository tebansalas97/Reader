<script lang="ts">
  import { t } from '$lib/i18n';

  interface Props {
    x: number;
    y: number;
    value: string;
    problem: string;
    busy: boolean;
    onchange: (value: string) => void;
    oncommit: () => void;
    oncancel: () => void;
  }

  const { x, y, value, problem, busy, onchange, oncommit, oncancel }: Props = $props();

  let node = $state<HTMLElement | null>(null);
  let field = $state<HTMLInputElement | null>(null);
  let left = $state(0);
  let top = $state(0);

  $effect(() => {
    const element = node;
    const wanted = { x, y };
    if (!element) return;
    const box = element.getBoundingClientRect();
    left = Math.max(8, Math.min(globalThis.innerWidth - box.width - 8, wanted.x - box.width / 2));
    top = Math.max(8, Math.min(globalThis.innerHeight - box.height - 8, wanted.y + 10));
  });

  $effect(() => {
    field?.focus();
    field?.select();
  });
</script>

<div
  bind:this={node}
  class="editor"
  style="left: {left}px; top: {top}px"
  role="dialog"
  tabindex="-1"
  aria-label={t('pdf.editText')}
>
  <input
    bind:this={field}
    class="field"
    class:wrong={problem !== ''}
    {value}
    aria-label={t('pdf.editText')}
    oninput={(event) => onchange(event.currentTarget.value)}
    onkeydown={(event) => {
      if (event.key === 'Enter') oncommit();
      if (event.key === 'Escape') oncancel();
    }}
  />

  <div class="row">
    <span class="problem">{problem}</span>
    <div class="grow"></div>
    <button class="text" onclick={oncancel}>{t('dialog.cancel')}</button>
    <button class="text primary" disabled={problem !== '' || busy} onclick={oncommit}>
      {t('pdf.editApply')}
    </button>
  </div>
</div>

<style>
  .editor {
    position: fixed;
    z-index: 40;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 330px;
    padding: 8px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
  }

  .field {
    height: 28px;
    padding: 0 6px;
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font: inherit;
    outline: none;
  }

  .field:focus {
    border-color: var(--accent);
  }

  .field.wrong {
    border-color: var(--danger);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .grow {
    flex: 1;
  }

  .problem {
    color: var(--danger);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 170px;
  }

  .text {
    height: 26px;
    padding: 0 9px;
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
</style>
