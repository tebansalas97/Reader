<script lang="ts">
  import { t } from '$lib/i18n';
  import { isMarkdown, isPdf, type Document } from '$lib/state/documents.svelte';
  import { ui } from '$lib/state/ui.svelte';
  import { countChars, countWords, readingMinutes } from '$lib/stats';

  interface Props {
    doc: Document | null;
    dirty: boolean;
    saving: boolean;
    selectedWords: number;
    onlineending: (value: 'lf' | 'crlf') => void;
  }

  const { doc, dirty, saving, selectedWords, onlineending }: Props = $props();

  const markdown = $derived(isMarkdown(doc) ? doc : null);
  const pdf = $derived(isPdf(doc) ? doc : null);

  const words = $derived(countWords(markdown?.text ?? ''));
  const chars = $derived(countChars(markdown?.text ?? ''));
  const minutes = $derived(readingMinutes(words));

  function toggleLineEnding(): void {
    if (!markdown) return;
    onlineending(markdown.lineEnding === 'lf' ? 'crlf' : 'lf');
  }

  const saveLabel = $derived(
    saving ? t('status.saving') : dirty ? t('status.unsaved') : t('status.saved'),
  );
</script>

<footer class="statusbar">
  {#if doc}
    {#if markdown}
      <span>{t('status.words', { n: words })}</span>
      <span class="dim">{t('status.chars', { n: chars })}</span>
      {#if minutes > 0}
        <span class="dim">{t('status.reading', { n: minutes })}</span>
      {/if}
      {#if selectedWords > 0}
        <span class="pill">{t('status.selected', { n: selectedWords })}</span>
      {/if}
    {:else if pdf}
      <span>{t('status.page', { page: pdf.page, total: pdf.pageCount })}</span>
      {#if pdf.encrypted}
        <span class="warn">{t('status.encrypted')}</span>
      {/if}
    {/if}

    <span class="grow"></span>

    {#if doc.readOnly}
      <span class="warn">{t('status.readOnly')}</span>
    {/if}

    {#if markdown}
      {#if ui.spellState !== 'off'}
        <span
          class="pill"
          class:loading={ui.spellState === 'loading'}
          class:failed={ui.spellState === 'failed'}
          title={t('spell.state.' + ui.spellState)}
        >
          {t('spell.state.' + ui.spellState)}
        </span>
      {/if}
      <button
        class="chip"
        class:on={ui.scrollSync}
        title={t('toolbar.syncHint')}
        aria-pressed={ui.scrollSync}
        onclick={() => ui.toggleScrollSync()}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5 3.5h6M5 12.5h6M8 4v8" />
          <path d="M6.5 5.5L8 4l1.5 1.5M6.5 10.5L8 12l1.5-1.5" />
        </svg>
        <span>{t('toolbar.sync')}</span>
      </button>
      <span class="dim">
        {t('status.position', { line: markdown.cursor.line, col: markdown.cursor.col })}
      </span>
      <button class="chip" onclick={toggleLineEnding} title="LF / CRLF">
        {markdown.lineEnding.toUpperCase()}
      </button>
    {/if}

    <span class="state" class:dirty>{saveLabel}</span>
  {/if}
</footer>

<style>
  .statusbar {
    display: flex;
    align-items: center;
    gap: 12px;
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

  .pill {
    padding: 1px 7px;
    border-radius: 9px;
    background: var(--accent-soft);
    color: var(--accent);
  }

  .pill.loading {
    background: var(--bg-inset);
    color: var(--text-faint);
  }

  .pill.failed {
    background: var(--bg-inset);
    color: var(--danger);
  }

  .chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 1px 6px;
    border-radius: 4px;
    color: var(--text-faint);
    font-size: 11px;
    letter-spacing: 0.04em;
  }

  .chip svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .chip:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .chip.on {
    color: var(--accent);
  }

  .state {
    color: var(--text-faint);
  }

  .state.dirty {
    color: var(--warning);
  }
</style>
