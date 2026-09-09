<script lang="ts">
  import { t } from '$lib/i18n';
  import type { OutlineEntry } from '$lib/pdf/document';

  interface Props {
    entries: OutlineEntry[];
    currentPage: number;
    onselect: (page: number) => void;
  }

  const { entries, currentPage, onselect }: Props = $props();

  const activeIndex = $derived(
    entries.reduce((best, entry, index) => {
      if (entry.page !== null && entry.page <= currentPage) return index;
      return best;
    }, -1),
  );
</script>

{#if entries.length === 0}
  <p class="empty">{t('pdf.noOutline')}</p>
{:else}
  <nav class="outline">
    {#each entries as entry, index (`${index}-${entry.title}`)}
      <button
        data-depth={entry.depth}
        style="padding-left: {10 + entry.depth * 12}px"
        disabled={entry.page === null}
        aria-current={index === activeIndex ? 'true' : undefined}
        class:active={index === activeIndex}
        title={entry.page === null ? t('pdf.outlineNoTarget') : entry.title}
        onclick={() => entry.page !== null && onselect(entry.page)}
      >
        <span class="title">{entry.title}</span>
        {#if entry.page !== null}<span class="page">{entry.page}</span>{/if}
      </button>
    {/each}
  </nav>
{/if}

<style>
  .outline {
    display: flex;
    flex-direction: column;
    padding: 4px 0;
    overflow-y: auto;
  }

  .outline button {
    display: flex;
    align-items: baseline;
    gap: 8px;
    text-align: left;
    padding-block: 4px;
    padding-right: 10px;
    color: var(--text-muted);
    border-left: 2px solid transparent;
  }

  .outline button:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text);
  }

  .outline button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .outline button.active {
    color: var(--text);
    border-left-color: var(--accent);
    background: var(--accent-soft);
  }

  .outline button[data-depth='0'] {
    font-weight: 600;
    color: var(--text);
  }

  .title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .page {
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }

  .empty {
    margin: 0;
    padding: 16px 12px;
    color: var(--text-faint);
  }
</style>
