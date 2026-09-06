<script lang="ts">
  import { t } from '$lib/i18n';
  import type { OutlineItem } from '$lib/preview/outline';

  interface Props {
    items: OutlineItem[];
    activeIndex: number;
    onselect: (line: number) => void;
  }

  const { items, activeIndex, onselect }: Props = $props();
</script>

{#if items.length === 0}
  <p class="empty">{t('sidebar.noHeadings')}</p>
{:else}
  <nav class="outline">
    {#each items as item, index (`${item.line}-${item.id}`)}
      <button
        data-level={item.level}
        style="padding-left: {10 + (item.level - 1) * 12}px"
        aria-current={index === activeIndex ? 'true' : undefined}
        class:active={index === activeIndex}
        onclick={() => onselect(item.line)}
      >{item.text}</button>
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
    text-align: left;
    padding-block: 4px;
    padding-right: 10px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border-left: 2px solid transparent;
  }

  .outline button:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .outline button.active {
    color: var(--text);
    border-left-color: var(--accent);
    background: var(--accent-soft);
  }

  .outline button[data-level='1'] {
    font-weight: 600;
    color: var(--text);
  }

  .empty {
    margin: 0;
    padding: 16px 12px;
    color: var(--text-faint);
  }
</style>
