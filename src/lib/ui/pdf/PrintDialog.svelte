<script lang="ts">
  import { untrack } from 'svelte';
  import { t } from '$lib/i18n';
  import { parseRange } from '$lib/pdf/print-range';

  interface Props {
    pageCount: number;
    initial?: string;
    onprint: (positions: number[]) => void;
    oncancel: () => void;
  }

  const { pageCount, initial = '', onprint, oncancel }: Props = $props();

  let text = $state(untrack(() => initial));
  let field = $state<HTMLInputElement | null>(null);

  const chosen = $derived(parseRange(text, pageCount));

  $effect(() => {
    field?.focus();
    field?.select();
  });

  function accept(): void {
    if (chosen.length === 0) return;
    onprint(chosen);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      oncancel();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      accept();
    }
  }
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="backdrop">
  <div class="panel" role="dialog" aria-modal="true" aria-label={t('print.title')}>
    <h2>{t('print.title')}</h2>
    <label>
      <span>{t('print.range')}</span>
      <input
        bind:this={field}
        bind:value={text}
        type="text"
        placeholder={t('print.all', { pages: pageCount })}
        aria-label={t('print.range')}
      />
    </label>
    <p class="hint" class:bad={chosen.length === 0}>
      {chosen.length === 0 ? t('print.none') : t('print.count', { pages: chosen.length })}
    </p>
    <div class="buttons">
      <button class="plain" onclick={oncancel}>{t('dialog.cancel')}</button>
      <button class="primary" disabled={chosen.length === 0} onclick={accept}>
        {t('print.go')}
      </button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.35);
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 320px;
    padding: 18px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
  }

  h2 {
    margin: 0;
    font-size: 1.05em;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--text-muted);
  }

  input {
    height: 30px;
    padding: 0 8px;
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    outline: none;
  }

  input:focus {
    border-color: var(--accent);
  }

  .hint {
    margin: 0;
    color: var(--text-faint);
  }

  .hint.bad {
    color: var(--danger, #ff6b6b);
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  button {
    height: 30px;
    padding: 0 14px;
    border-radius: 6px;
  }

  .plain {
    background: var(--bg-inset);
    color: var(--text-muted);
  }

  .primary {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .primary:disabled {
    opacity: 0.5;
  }
</style>
