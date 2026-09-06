<script lang="ts">
  import { searchFolder } from '$lib/fs/api';
  import type { SearchHit } from '$lib/fs/api-types';
  import { basename } from '$lib/fs/paths';
  import { t } from '$lib/i18n';
  import { ui } from '$lib/state/ui.svelte';

  interface Props {
    onopen: (path: string, line: number) => void;
    onopenfolder: () => void;
  }

  const { onopen, onopenfolder }: Props = $props();

  let query = $state('');
  let caseSensitive = $state(false);
  let hits = $state<SearchHit[]>([]);
  let truncated = $state(false);
  let scanned = $state(0);
  let running = $state(false);
  let searched = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const groups = $derived(
    hits.reduce<Array<{ path: string; name: string; items: SearchHit[] }>>((acc, hit) => {
      const last = acc[acc.length - 1];
      if (last && last.path === hit.path) last.items.push(hit);
      else acc.push({ path: hit.path, name: hit.name, items: [hit] });
      return acc;
    }, []),
  );

  async function run(): Promise<void> {
    const folder = ui.folder;
    const needle = query.trim();
    if (!folder || needle.length < 2) {
      hits = [];
      truncated = false;
      searched = needle.length > 0;
      return;
    }
    running = true;
    try {
      const outcome = await searchFolder(folder, needle, caseSensitive);
      hits = outcome.hits;
      truncated = outcome.truncated;
      scanned = outcome.filesScanned;
      searched = true;
    } catch {
      hits = [];
      truncated = false;
    } finally {
      running = false;
    }
  }

  function schedule(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void run(), 220);
  }

  $effect(() => {
    void query;
    void caseSensitive;
    void ui.folder;
    schedule();
    return () => {
      if (timer) clearTimeout(timer);
    };
  });
</script>

<div class="search">
  <div class="controls">
    <input
      type="search"
      bind:value={query}
      placeholder={t('search.placeholder')}
      aria-label={t('search.placeholder')}
    />
    <button
      class="case"
      class:on={caseSensitive}
      title={t('search.caseSensitive')}
      aria-pressed={caseSensitive}
      onclick={() => (caseSensitive = !caseSensitive)}
    >Aa</button>
  </div>

  {#if ui.folder === null}
    <div class="empty">
      <p>{t('sidebar.empty')}</p>
      <button class="link" onclick={onopenfolder}>{t('sidebar.openFolder')}</button>
    </div>
  {:else if running}
    <p class="note">{t('search.running')}</p>
  {:else if hits.length > 0}
    <p class="note">
      {t('search.summary', { hits: hits.length, files: groups.length, scanned })}
      {#if truncated}<span class="warn">{t('search.truncated')}</span>{/if}
    </p>
    <div class="results">
      {#each groups as group (group.path)}
        <div class="group">
          <p class="file" title={group.path}>{group.name}<span>{group.items.length}</span></p>
          {#each group.items as hit (`${hit.path}:${hit.line}:${hit.column}`)}
            <button class="hit" onclick={() => onopen(hit.path, hit.line)}>
              <span class="line">{hit.line + 1}</span>
              <span class="text">{hit.text}</span>
            </button>
          {/each}
        </div>
      {/each}
    </div>
  {:else if searched && query.trim().length >= 2}
    <p class="note">{t('search.none')}</p>
  {:else}
    <p class="note">{t('search.hint', { folder: basename(ui.folder) })}</p>
  {/if}
</div>

<style>
  .search {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }

  .controls {
    display: flex;
    gap: 4px;
    padding: 8px;
    flex-shrink: 0;
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 5px 8px;
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: 5px;
    outline: none;
  }

  input:focus {
    border-color: var(--accent);
  }

  .case {
    width: 28px;
    border-radius: 5px;
    color: var(--text-faint);
    font-size: 11px;
  }

  .case:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .case.on {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .note {
    margin: 0;
    padding: 4px 10px 10px;
    color: var(--text-faint);
    font-size: 0.92em;
  }

  .warn {
    color: var(--warning);
    margin-left: 6px;
  }

  .results {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .group {
    margin-bottom: 6px;
  }

  .file {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin: 0;
    padding: 4px 10px;
    color: var(--text);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file span {
    color: var(--text-faint);
    font-weight: 400;
  }

  .hit {
    display: flex;
    gap: 8px;
    width: 100%;
    padding: 3px 10px 3px 16px;
    text-align: left;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
  }

  .hit:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .line {
    min-width: 28px;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
    text-align: right;
    flex-shrink: 0;
  }

  .text {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty {
    padding: 16px 12px;
    color: var(--text-faint);
  }

  .empty p {
    margin: 0 0 8px;
  }

  .link {
    color: var(--accent);
    text-decoration: underline;
  }
</style>
