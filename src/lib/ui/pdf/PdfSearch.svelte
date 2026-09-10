<script lang="ts">
  import { t } from '$lib/i18n';
  import type { PdfHandle } from '$lib/pdf/document';
  import {
    extractAllText,
    findInPages,
    groupByPage,
    itemRanges,
    itemsForMatch,
    type PdfMatch,
  } from '$lib/pdf/search';

  interface Props {
    handle: PdfHandle | null;
    currentPage: number;
    onselect: (page: number, items: number[]) => void;
  }

  const { handle, currentPage, onselect }: Props = $props();

  let query = $state('');
  let matches = $state<PdfMatch[]>([]);
  let truncated = $state(false);
  let running = $state(false);
  let searched = $state(false);
  let chosen = $state<string | null>(null);

  let cache = new Map<number, string>();
  let pages: string[] = [];
  let source: PdfHandle | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const groups = $derived(groupByPage(matches));

  $effect(() => {
    if (handle === source) return;
    source = handle;
    cache = new Map();
    pages = [];
    matches = [];
    searched = false;
    query = '';
  });

  async function textOfDocument(): Promise<string[]> {
    if (!handle) return [];
    if (pages.length === handle.pageCount) return pages;
    pages = await extractAllText(handle, cache);
    return pages;
  }

  async function run(): Promise<void> {
    const needle = query.trim();
    if (!handle || needle.length < 2) {
      matches = [];
      truncated = false;
      searched = needle.length > 0;
      return;
    }

    running = true;
    try {
      const outcome = findInPages(await textOfDocument(), needle);
      matches = outcome.matches;
      truncated = outcome.truncated;
      searched = true;
    } catch {
      matches = [];
      truncated = false;
    } finally {
      running = false;
    }
  }

  function schedule(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void run(), 220);
  }

  async function go(match: PdfMatch): Promise<void> {
    chosen = `${match.page}:${match.index}`;
    if (!handle) return;
    const proxy = await handle.page(match.page).catch(() => null);
    const content = await proxy?.getTextContent().catch(() => null);
    const items = content
      ? itemsForMatch(itemRanges(content.items), match.index, query.trim().length)
      : [];
    onselect(match.page, items);
  }
</script>

<div class="search">
  <div class="bar">
    <input
      class="query"
      type="search"
      placeholder={t('pdfSearch.placeholder')}
      aria-label={t('pdfSearch.placeholder')}
      bind:value={query}
      oninput={schedule}
      onkeydown={(event) => {
        if (event.key === 'Enter') void run();
      }}
    />
  </div>

  {#if running}
    <p class="note">{t('search.running')}</p>
  {:else if searched && matches.length === 0}
    <p class="note">{t('pdfSearch.none')}</p>
  {:else if matches.length > 0}
    <p class="note">
      {t('pdfSearch.found', { hits: matches.length, pages: groups.length })}
      {truncated ? ` ${t('search.truncated')}` : ''}
    </p>
    <ul class="groups">
      {#each groups as group (group.page)}
        <li>
          <p class="page" class:here={group.page === currentPage}>
            {t('pdf.page')}
            {group.page}
          </p>
          <ul class="hits">
            {#each group.items as match (match.index)}
              <li>
                <button
                  class="hit"
                  class:on={chosen === `${match.page}:${match.index}`}
                  onclick={() => void go(match)}
                >
                  {match.text}
                </button>
              </li>
            {/each}
          </ul>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="note">{t('pdfSearch.hint')}</p>
  {/if}
</div>

<style>
  .search {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .bar {
    padding: 8px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .query {
    width: 100%;
    height: 28px;
    padding: 0 8px;
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    outline: none;
  }

  .query:focus {
    border-color: var(--accent);
  }

  .note {
    margin: 0;
    padding: 8px 10px;
    color: var(--text-faint);
  }

  .groups,
  .hits {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .groups {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .page {
    margin: 0;
    padding: 6px 10px 2px;
    font-size: 0.92em;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .page.here {
    color: var(--accent);
  }

  .hit {
    display: block;
    width: 100%;
    padding: 5px 10px;
    text-align: left;
    color: var(--text-muted);
    line-height: 1.35;
  }

  .hit:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .hit.on {
    background: var(--accent-soft);
    color: var(--accent);
  }
</style>
