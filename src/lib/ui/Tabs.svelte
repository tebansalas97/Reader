<script lang="ts">
  import { t } from '$lib/i18n';
  import type { TabItem } from './types';

  interface Props {
    items: TabItem[];
    activeId: string | null;
    onselect: (id: string) => void;
    onclose: (id: string) => void;
  }

  const { items, activeId, onselect, onclose }: Props = $props();
</script>

<div class="tabs" role="tablist" data-tauri-drag-region>
  {#each items as item (item.id)}
    <div
      class="tab"
      class:active={item.id === activeId}
      role="tab"
      tabindex="0"
      aria-selected={item.id === activeId}
      title={item.title}
      onclick={() => onselect(item.id)}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onselect(item.id);
        }
      }}
      onauxclick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          onclose(item.id);
        }
      }}
    >
      <span class="label">{item.title}</span>
      {#if item.dirty}
        <span class="dot" title={t('status.unsaved')}></span>
      {/if}
      <button
        class="close"
        aria-label={t('menu.close')}
        onclick={(e) => {
          e.stopPropagation();
          onclose(item.id);
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1.4" fill="none" />
        </svg>
      </button>
    </div>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    align-items: stretch;
    gap: 1px;
    overflow-x: auto;
    scrollbar-width: none;
    min-width: 0;
    flex: 1;
  }

  .tabs::-webkit-scrollbar {
    display: none;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 6px 0 12px;
    max-width: 200px;
    min-width: 90px;
    height: 100%;
    border-top: 2px solid transparent;
    color: var(--text-muted);
    background: transparent;
    cursor: default;
    white-space: nowrap;
    -webkit-app-region: no-drag;
  }

  .tab:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .tab.active {
    background: var(--bg);
    border-top-color: var(--accent);
    color: var(--text);
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-muted);
    flex-shrink: 0;
  }

  .close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    color: var(--text-muted);
    opacity: 0;
    flex-shrink: 0;
  }

  .tab:hover .close,
  .tab.active .close,
  .close:focus-visible {
    opacity: 1;
  }

  .close:hover {
    background: var(--bg-inset);
    color: var(--text);
  }
</style>
