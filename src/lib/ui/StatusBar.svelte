<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Document } from '$lib/state/documents.svelte';
  import { countChars, countWords, readingMinutes } from '$lib/stats';

  interface Props {
    doc: Document | null;
    dirty: boolean;
    saving: boolean;
    onlineending: (value: 'lf' | 'crlf') => void;
  }

  const { doc, dirty, saving, onlineending }: Props = $props();

  const words = $derived(countWords(doc?.text ?? ''));
  const chars = $derived(countChars(doc?.text ?? ''));
  const minutes = $derived(readingMinutes(words));

  function toggleLineEnding(): void {
    if (!doc) return;
    onlineending(doc.lineEnding === 'lf' ? 'crlf' : 'lf');
  }

  const saveLabel = $derived(saving ? t('status.saving') : dirty ? t('status.unsaved') : t('status.saved'));
</script>

<footer class="statusbar">
  {#if doc}
    <span>{t('status.words', { n: words })}</span>
    <span class="dim">{t('status.chars', { n: chars })}</span>
    {#if minutes > 0}
      <span class="dim">{t('status.reading', { n: minutes })}</span>
    {/if}
    <span class="grow"></span>
    {#if doc.readOnly}
      <span class="warn">{t('status.readOnly')}</span>
    {/if}
    <span class="dim">{t('status.position', { line: doc.cursor.line, col: doc.cursor.col })}</span>
    <button class="chip" onclick={toggleLineEnding} title="LF / CRLF">
      {doc.lineEnding.toUpperCase()}
    </button>
    <span class="state" class:dirty>{saveLabel}</span>
  {/if}
</footer>

<style>
  .statusbar {
    display: flex;
    align-items: center;
    gap: 14px;
    height: var(--statusbar-height);
    padding: 0 12px;
    flex-shrink: 0;
    background: var(--bg-elevated);
    border-top: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
  }

  .grow {
    flex: 1;
  }

  .dim {
    color: var(--text-faint);
  }

  .warn {
    color: var(--warning);
  }

  .chip {
    padding: 1px 6px;
    border-radius: 4px;
    color: var(--text-faint);
    font-size: 11px;
    letter-spacing: 0.04em;
  }

  .chip:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .state {
    color: var(--text-faint);
  }

  .state.dirty {
    color: var(--warning);
  }
</style>
