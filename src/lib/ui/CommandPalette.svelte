<script lang="ts">
  import { COMMANDS, filterCommands } from '$lib/commands';
  import { t } from '$lib/i18n';

  interface Props {
    hasDocument: boolean;
    onrun: (id: string) => void;
    onclose: () => void;
  }

  const { hasDocument, onrun, onclose }: Props = $props();

  let query = $state('');
  let cursor = $state(0);
  let input = $state<HTMLInputElement | null>(null);
  let listbox = $state<HTMLElement | null>(null);

  const results = $derived(filterCommands(COMMANDS, query, t, hasDocument));

  const GROUPS: Record<string, string> = {
    file: 'command.groupFile',
    edit: 'command.groupEdit',
    insert: 'command.groupInsert',
    view: 'command.groupView',
  };

  $effect(() => {
    input?.focus();
  });

  $effect(() => {
    void query;
    cursor = 0;
  });

  $effect(() => {
    void cursor;
    listbox
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  });

  function choose(id: string): void {
    onclose();
    onrun(id);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onclose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      cursor = results.length === 0 ? 0 : (cursor + 1) % results.length;
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      cursor = results.length === 0 ? 0 : (cursor - 1 + results.length) % results.length;
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = results[cursor];
      if (item) choose(item.id);
    }
  }
</script>

<div class="backdrop" role="presentation" onclick={onclose}>
  <div
    class="palette"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-label={t('command.title')}
    onclick={(event) => event.stopPropagation()}
    onkeydown={onKeyDown}
  >
    <input
      bind:this={input}
      bind:value={query}
      type="text"
      role="combobox"
      aria-expanded="true"
      aria-controls="palette-results"
      aria-autocomplete="list"
      placeholder={t('command.placeholder')}
    />
    <div class="results" id="palette-results" role="listbox" bind:this={listbox}>
      {#if results.length === 0}
        <p class="empty">{t('command.empty')}</p>
      {:else}
        {#each results as item, index (item.id)}
          <button
            role="option"
            aria-selected={index === cursor}
            class:active={index === cursor}
            onmouseenter={() => (cursor = index)}
            onclick={() => choose(item.id)}
          >
            <span class="group">{t(GROUPS[item.group] ?? '')}</span>
            <span class="label">{item.label}</span>
            {#if item.hint}<kbd>{item.hint}</kbd>{/if}
          </button>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 65;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 12vh;
    background: rgba(0, 0, 0, 0.42);
  }

  .palette {
    width: min(560px, calc(100% - 48px));
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  input {
    padding: 13px 16px;
    font-size: 15px;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border);
    outline: none;
  }

  .results {
    overflow-y: auto;
    padding: 4px;
  }

  .results button {
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    padding: 7px 10px;
    border-radius: 5px;
    text-align: left;
  }

  .results button.active {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .group {
    min-width: 72px;
    font-size: 0.85em;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  kbd {
    font-family: inherit;
    font-size: 0.85em;
    color: var(--text-faint);
  }

  .results button.active .group,
  .results button.active kbd {
    color: var(--accent-contrast);
    opacity: 0.75;
  }

  .empty {
    margin: 0;
    padding: 18px 12px;
    color: var(--text-faint);
    text-align: center;
  }
</style>
